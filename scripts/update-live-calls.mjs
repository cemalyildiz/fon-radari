import { readFile, writeFile, rename } from "node:fs/promises";
import { pathToFileURL } from "node:url";
import { destinationIdentifier, officialDestination } from "../app/live-source.mjs";

const API_URL = "https://api.tech.ec.europa.eu/search-api/prod/rest/search";
const TARGET = "public/live-calls.json";
const iso = value => typeof value === "string" && Number.isFinite(Date.parse(value)) ? new Date(value).toISOString() : null;
export function parseResult(item, checkedAt) {
  const m = item?.metadata ?? {};
  const originalIdentifier = m.identifier?.[0];
  const kind = { "1": "topic", "2": "external", "8": "cascade" }[m.type?.[0]];
  const destination = officialDestination(m.url?.[0]);
  if (!destination || destination.kind !== kind) return null;
  if (kind === "topic" && (typeof originalIdentifier !== "string" || originalIdentifier.toLowerCase() !== destination.id.toLowerCase())) return null;
  if (kind === "external" && typeof originalIdentifier === "string" && /^EuropeAid\//i.test(originalIdentifier)
    && originalIdentifier.split("/")[1] !== destination.id) return null;
  // Several independent competitions share one public portal listing URL.
  const sourceRecordId = kind === "cascade" ? /^(\d+)COMPETITIVE_CALL[a-z-]+$/i.exec(m.REFERENCE?.[0] ?? "")?.[1] : undefined;
  if (kind === "cascade" && !sourceRecordId) return null;
  const identifier = destinationIdentifier(destination, sourceRecordId);
  const deadlines = [...new Set((m.deadlineDate ?? []).map(iso).filter(Boolean))].sort();
  if (!deadlines.length) return null;
  const deadline = deadlines.find(d => d > checkedAt) ?? deadlines.at(-1);
  const title = kind === "cascade" ? m.callTitle?.[0] : m.title?.[0] ?? item.summary;
  if (typeof title !== "string" || !title.trim()) return null;
  const closure = kind === "cascade" ? iso(m.closingDate?.[0]) : null;
  const conflictingDates = closure && Date.parse(closure) + 86_400_000 < Date.parse(deadline);
  return {
    identifier, title: title.trim(), sourceKind: kind,
    ...(sourceRecordId ? { sourceRecordId } : {}),
    ...(typeof m.language?.[0] === "string" ? { sourceLanguage: m.language[0].toLowerCase() } : {}),
    ...(kind !== "topic" && typeof originalIdentifier === "string" ? { sourceReference: originalIdentifier } : {}),
    deadlines, deadline,
    startDate: iso(m.startDate?.[0]), status: conflictingDates && ["31094501", "31094502"].includes(m.status?.[0]) ? "unknown" : m.status?.[0] ?? "unknown",
    ...(conflictingDates ? { sourceWarning: "AB verisinde kapanış ve son başvuru alanları farklı. Güncel kabul durumunu alt çağrı bağlantısından kontrol edin." } : {}),
    actionType: m.typesOfAction?.[0] ?? "Çağrı koşullarına bağlı",
    sourceCheckedAt: checkedAt,
    url: destination.url,
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
    const languageOrder = value => value === "en" ? "0" : value ? `1-${value}` : "2";
    if (existing && languageOrder(existing.sourceLanguage) < languageOrder(call.sourceLanguage)) continue;
    const sameLanguage = existing?.sourceLanguage === call.sourceLanguage;
    // Group duplicate action types, but do not resurrect obsolete historical deadlines.
    const deadlines = [...new Set([...(sameLanguage ? existing?.deadlines ?? [] : []), ...call.deadlines])].sort();
    grouped.set(key, { ...call, deadlines, deadline: deadlines.find(d => d > checkedAt) ?? deadlines.at(-1) });
  }
  for (const [key, call] of grouped) records.set(key, call);
  return [...records.values()].sort((a,b) => a.identifier.localeCompare(b.identifier));
}
export async function collect(fetcher = fetch, checkedAt = new Date().toISOString(), { legacyIdentifiers = [] } = {}) {
  const pageSize = 100;
  async function page(number, from, until, identifiers) {
    const url = new URL(API_URL);
    Object.entries({apiKey:"SEDIA", text:"*", pageSize:String(pageSize), pageNumber:String(number), language:"en"}).forEach(([k,v]) => url.searchParams.set(k,v));
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const form = new FormData();
        form.append("query", new Blob([JSON.stringify({ bool: { must: [
          { terms: { type: ["1", "2", "8"] } },
          { term: { programmePeriod: "2021 - 2027" } },
          ...(identifiers
            ? [{ terms: { identifier: identifiers } }, { term: { language: "en" } }]
            : [{ range: { deadlineDate: { gte: from, ...(until ? { lt: until } : {}) } } }]),
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
  const parsed = all.map(item => parseResult(item, checkedAt)).filter(Boolean);
  const calls = parsed.filter(c => c.deadlines.some(d => d > checkedAt));
  if (!calls.length) throw new Error("No dated calls returned; retaining last successful data");
  const historical = parsed.filter(c => c.deadlines.every(d => d <= checkedAt));
  const knownIds = new Set(parsed.flatMap(c => [c.identifier, c.sourceReference].filter(Boolean)).map(id => id.toLowerCase()));
  const missingLegacy = [...new Set(legacyIdentifiers.filter(id => typeof id === "string" && /^[a-z0-9_.-]+$/i.test(id) && !knownIds.has(id.toLowerCase())))];
  // One-time archive repair for legacy topic IDs that are absent from the current date windows.
  for (let offset = 0; offset < missingLegacy.length; offset += 60) {
    const identifiers = missingLegacy.slice(offset, offset + 60);
    const accepted = new Set(identifiers.map(id => id.toLowerCase()));
    try {
      const first = await page(1, undefined, undefined, identifiers);
      if (first.totalResults > 1000) throw new Error("Unexpected legacy lookup result count");
      const found = [...first.results];
      for (let p = 2; p <= Math.ceil(first.totalResults / pageSize); p++) found.push(...(await page(p, undefined, undefined, identifiers)).results);
      if (found.length < first.totalResults) throw new Error("Incomplete legacy lookup");
      for (const item of found) {
        const call = parseResult(item, checkedAt);
        if (!call || ![call.identifier, call.sourceReference].some(id => id && accepted.has(id.toLowerCase()))) continue;
        if (call.deadlines.every(d => d <= checkedAt) || ["31094503","310945031","99999998"].includes(call.status)) historical.push(call);
        else calls.push(call);
      }
    } catch (error) {
      console.warn(`Legacy archive lookup deferred: ${error.message}`);
    }
  }
  return { calls, historical, scannedRecords:all.length, pages };
}
export function migrateLegacy(previous, incoming, historical, checkedAt) {
  const legacy = [...(previous.unresolvedLegacy ?? []), ...(previous.calls ?? []).filter(c => !c.sourceKind)];
  const legacyKeys = new Set(legacy.map(c => c.identifier.toLowerCase()));
  const keys = c => [c.identifier, c.sourceReference].filter(Boolean).map(x => x.toLowerCase());
  const matchedHistory = historical.filter(c => keys(c).some(k => legacyKeys.has(k)));
  const matchedKeys = new Set([...incoming, ...matchedHistory].flatMap(keys));
  return {
    calls: reconcile((previous.calls ?? []).filter(c => c.sourceKind), [...matchedHistory, ...incoming], checkedAt),
    // Preserve the prior data for review; never display a guessed URL as a current call.
    unresolvedLegacy: legacy.filter(c => !matchedKeys.has(c.identifier.toLowerCase())),
  };
}
export async function update() {
  let previous = {calls:[], checkedAt:null};
  try { previous = JSON.parse(await readFile(TARGET,"utf8")); } catch (error) { if (error.code !== "ENOENT") throw error; }
  const attemptedAt = new Date().toISOString();
  let output;
  try {
    const result = await collect(fetch, attemptedAt, { legacyIdentifiers: (previous.calls ?? []).filter(c => !c.sourceKind).map(c => c.identifier) });
    output = {source:"European Commission Funding & Tenders Portal API", schemaVersion:2, checkedAt:attemptedAt, attemptedAt,
      degraded:false, scannedRecords:result.scannedRecords, pages:result.pages,
      ...migrateLegacy(previous, result.calls, result.historical, attemptedAt)};
    console.log(`Scanned ${result.pages} pages; retained ${output.calls.length} unique calls including archive.`);
  } catch (error) {
    output = {...previous, attemptedAt, degraded:true};
    console.error(`::warning::Source refresh failed; last successful data retained. ${error.message}`);
  }
  await writeFile(`${TARGET}.tmp`, `${JSON.stringify(output,null,2)}\n`);
  await rename(`${TARGET}.tmp`, TARGET);
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) await update();
