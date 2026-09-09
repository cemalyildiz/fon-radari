import { readFile, writeFile, rename } from "node:fs/promises";
import { pathToFileURL } from "node:url";

const API_URL = "https://api.tech.ec.europa.eu/search-api/prod/rest/search";
const TARGET = "public/live-calls.json";
const iso = value => typeof value === "string" && Number.isFinite(Date.parse(value)) ? new Date(value).toISOString() : null;
export function parseResult(item, checkedAt) {
  const m = item?.metadata ?? {};
  const identifier = m.identifier?.[0];
  if (typeof identifier !== "string" || !/^[a-z0-9_.-]+$/i.test(identifier)) return null;
  const deadlines = [...new Set((m.deadlineDate ?? []).map(iso).filter(Boolean))].sort();
  if (!deadlines.length) return null;
  return {
    identifier, title: m.title?.[0] ?? item.summary ?? identifier,
    deadlines, deadline: deadlines.find(d => d > checkedAt) ?? deadlines.at(-1),
    startDate: iso(m.startDate?.[0]), status: m.status?.[0] ?? "unknown",
    actionType: m.typesOfAction?.[0] ?? "Çağrı koşullarına bağlı",
    sourceCheckedAt: checkedAt,
    url: `https://ec.europa.eu/info/funding-tenders/opportunities/portal/screen/opportunities/topic-details/${identifier.toLowerCase()}`,
  };
}
export function reconcile(previous, incoming, checkedAt) {
  const records = new Map((previous ?? []).map(c => [c.identifier.toLowerCase(), c]));
  const current = new Set(incoming.map(c => c.identifier.toLowerCase()));
  for (const [id, call] of records) {
    if (!current.has(id) && (call.deadlines ?? [call.deadline]).some(d => d && Date.parse(d) > Date.parse(checkedAt))) records.set(id, { ...call, status: "unknown" });
  }
  const grouped = new Map();
  for (const call of incoming) {
    const key = call.identifier.toLowerCase();
    const existing = grouped.get(key);
    // Group duplicate action types, but do not resurrect obsolete historical deadlines.
    const deadlines = [...new Set([...(existing?.deadlines ?? []), ...call.deadlines])].sort();
    grouped.set(key, { ...call, deadlines, deadline: deadlines.find(d => d > checkedAt) ?? deadlines.at(-1) });
  }
  for (const [key, call] of grouped) records.set(key, call);
  return [...records.values()].sort((a,b) => a.identifier.localeCompare(b.identifier));
}
export async function collect(fetcher = fetch, checkedAt = new Date().toISOString()) {
  const pageSize = 100;
  async function page(number, from, until) {
    const url = new URL(API_URL);
    Object.entries({apiKey:"SEDIA", text:"*", pageSize:String(pageSize), pageNumber:String(number), language:"en"}).forEach(([k,v]) => url.searchParams.set(k,v));
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const form = new FormData();
        form.append("query", new Blob([JSON.stringify({ bool: { must: [
          { terms: { type: ["1", "2", "8"] } },
          { term: { programmePeriod: "2021 - 2027" } },
          { range: { deadlineDate: { gte: from, ...(until ? { lt: until } : {}) } } },
        ] } })], {type:"application/json"}), "query.json");
        const response = await fetcher(url, {method:"POST", body:form, signal:AbortSignal.timeout(30_000)});
        if (!response.ok) throw new Error(`API HTTP ${response.status}`);
        const data = await response.json();
        if (!Array.isArray(data.results) || !Number.isInteger(data.totalResults) || data.totalResults < 0 || data.warnings?.length) throw new Error("Invalid or partial API response");
        return data;
      } catch (error) {
        if (attempt === 2) throw error;
        await new Promise(resolve => setTimeout(resolve, 500 * 2 ** attempt));
      }
    }
  }
  let pages = 0;
  async function window(from, until, depth = 0) {
    if (depth > 20) throw new Error("Search partition limit reached; refusing partial update");
    const first = await page(1, from, until); pages++;
    // The source caps a query at 10,000 results. Split date windows before that limit.
    if (first.totalResults > 5000) {
      const start = Date.parse(from);
      const end = until ? Date.parse(until) : start + 366 * 86_400_000;
      if (end - start < 86_400_000) throw new Error("Too many results for one day");
      const middle = new Date(until ? Math.floor((start + end) / 2) : end).toISOString();
      return [...await window(from, middle, depth + 1), ...await window(middle, until, depth + 1)];
    }
    const count = Math.ceil(first.totalResults / pageSize);
    const records = [...first.results];
    for (let start = 2; start <= count; start += 4) {
      const batch = await Promise.all(Array.from({length:Math.min(4,count-start+1)}, (_,i) => page(start+i, from, until)));
      for (const result of batch) {
        pages++;
        if (!result.results.length) throw new Error("Incomplete pagination");
        records.push(...result.results);
      }
    }
    if (records.length < first.totalResults) throw new Error("Incomplete result count");
    return records;
  }
  const all = await window(checkedAt);
  const calls = all.map(item => parseResult(item, checkedAt)).filter(c => c && c.deadlines.some(d => d > checkedAt));
  if (!calls.length) throw new Error("No dated calls returned; retaining last successful data");
  return { calls, scannedRecords:all.length, pages };
}
export async function update() {
  let previous = {calls:[], checkedAt:null};
  try { previous = JSON.parse(await readFile(TARGET,"utf8")); } catch (error) { if (error.code !== "ENOENT") throw error; }
  const attemptedAt = new Date().toISOString();
  let output;
  try {
    const result = await collect(fetch, attemptedAt);
    output = {source:"European Commission Funding & Tenders Portal API", checkedAt:attemptedAt, attemptedAt,
      degraded:false, scannedRecords:result.scannedRecords, pages:result.pages,
      calls:reconcile(previous.calls, result.calls, attemptedAt)};
    console.log(`Scanned ${result.pages} pages; retained ${output.calls.length} unique calls including archive.`);
  } catch (error) {
    output = {...previous, attemptedAt, degraded:true};
    console.error(`::warning::Source refresh failed; last successful data retained. ${error.message}`);
  }
  await writeFile(`${TARGET}.tmp`, `${JSON.stringify(output,null,2)}\n`);
  await rename(`${TARGET}.tmp`, TARGET);
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) await update();
