import { mkdir, writeFile } from "node:fs/promises";

const API_URL =
  "https://api.tech.ec.europa.eu/search-api/prod/rest/search?apiKey=SEDIA&text=2026&pageSize=100&pageNumber=1&language=en";

const query = {
  bool: {
    must: [
      { terms: { type: ["1", "2", "8"] } },
      { term: { programmePeriod: "2021 - 2027" } },
    ],
  },
};

const form = new FormData();
form.append(
  "query",
  new Blob([JSON.stringify(query)], { type: "application/json" }),
  "query.json",
);

const response = await fetch(API_URL, {
  method: "POST",
  body: form,
  headers: { Accept: "application/json" },
});

if (!response.ok) {
  throw new Error(`Funding & Tenders API returned ${response.status}`);
}

const payload = await response.json();
const now = Date.now();
const calls = (payload.results ?? [])
  .map((item) => {
    const metadata = item.metadata ?? {};
    const deadline = (metadata.deadlineDate ?? [])
      .map((date) => new Date(date))
      .filter((date) => !Number.isNaN(date.getTime()) && date.getTime() > now)
      .sort((a, b) => a.getTime() - b.getTime())[0];
    const identifier = metadata.identifier?.[0];
    if (!deadline || !identifier) return null;
    return {
      identifier,
      title: metadata.title?.[0] ?? item.summary ?? identifier,
      callIdentifier: metadata.callIdentifier?.[0] ?? identifier,
      deadline: deadline.toISOString(),
      startDate: metadata.startDate?.[0] ?? null,
      actionType: metadata.typesOfAction?.[0] ?? "EU grant",
      url: `https://ec.europa.eu/info/funding-tenders/opportunities/portal/screen/opportunities/topic-details/${identifier.toLowerCase()}`,
    };
  })
  .filter(Boolean)
  .sort((a, b) => new Date(a.deadline).getTime() - new Date(b.deadline).getTime())
  .slice(0, 12);

await mkdir("public", { recursive: true });
await writeFile(
  "public/live-calls.json",
  `${JSON.stringify(
    {
      source: "European Commission Funding & Tenders Portal API",
      checkedAt: new Date().toISOString(),
      calls,
    },
    null,
    2,
  )}\n`,
);

console.log(`Updated public/live-calls.json with ${calls.length} calls.`);
