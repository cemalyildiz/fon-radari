export const cluster4Programme = "https://research-and-innovation.ec.europa.eu/document/download/87a8c19b-2643-49ec-8d07-37781ceb516e_en";
export const cluster4ProgrammeIndex = "https://research-and-innovation.ec.europa.eu/funding/funding-opportunities/funding-programmes-and-open-calls/horizon-europe/cluster-4-digital-industry-and-space_en";

export function revisionIndexFor(evidenceUrl) {
  return evidenceUrl === cluster4Programme ? cluster4ProgrammeIndex : undefined;
}

export function listedCluster4Programme(html) {
  const links = new Set();
  for (const [tag] of html.matchAll(/<a\b[^>]*>/gi)) {
    if (!/\sdata-untranslated-label\s*=\s*["']Horizon Europe Work programme \(2026-27\) - Cluster 4["']/i.test(tag)) continue;
    const href = tag.match(/\shref\s*=\s*["']([^"']+)["']/i)?.[1];
    if (!href) continue;
    try {
      const url = new URL(href, cluster4ProgrammeIndex);
      if (url.origin === "https://research-and-innovation.ec.europa.eu" && !url.username && !url.password &&
          /^\/document\/download\/[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}_en$/i.test(url.pathname)) {
        links.add(url.origin + url.pathname);
      }
    } catch { /* Ignore invalid links. */ }
  }
  if (links.size !== 1) throw new Error("Güncel Küme 4 çalışma programı bağlantısı tekil olarak bulunamadı");
  return [...links][0];
}
