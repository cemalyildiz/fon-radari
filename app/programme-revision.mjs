export const cluster4Programme = "https://research-and-innovation.ec.europa.eu/document/download/87a8c19b-2643-49ec-8d07-37781ceb516e_en";
export const cluster4ProgrammeIndex = "https://research-and-innovation.ec.europa.eu/funding/funding-opportunities/funding-programmes-and-open-calls/horizon-europe/cluster-4-digital-industry-and-space_en";
export const cleanIndustryProgramme = "https://research-and-innovation.ec.europa.eu/document/download/01964d0c-a8eb-4f23-baa4-87d96812dca6_en";
export const horizontalProgrammeIndex = "https://research-and-innovation.ec.europa.eu/funding/funding-opportunities/funding-programmes-and-open-calls/horizon-europe/horizon-europe-work-programmes_en";
export const cluster5Programme = "https://research-and-innovation.ec.europa.eu/document/download/1e480813-74f9-4ebf-a189-3c743de95e7e_en";
export const cluster5ProgrammeIndex = "https://research-and-innovation.ec.europa.eu/funding/funding-opportunities/funding-programmes-and-open-calls/horizon-europe/cluster-5-climate-energy-and-mobility_en";
const programmes = [
  { index: cluster4ProgrammeIndex, pdf: cluster4Programme, section: "Cluster 4" },
  { index: horizontalProgrammeIndex, pdf: cleanIndustryProgramme, section: "Horizontal activities" },
  { index: cluster5ProgrammeIndex, pdf: cluster5Programme, section: "Cluster 5" },
];

export function revisionIndexFor(evidenceUrl) {
  return programmes.find(p => p.pdf === evidenceUrl)?.index;
}

export function programmeAtIndex(index) {
  return programmes.find(p => p.index === index);
}

export function listedProgramme(html, { index, section }) {
  const links = new Set();
  for (const [tag] of html.matchAll(/<a\b[^>]*>/gi)) {
    const label = tag.match(/\sdata-untranslated-label\s*=\s*["']([^"']+)["']/i)?.[1];
    if (label?.toLowerCase() !== `Horizon Europe Work programme (2026-27) - ${section}`.toLowerCase()) continue;
    const href = tag.match(/\shref\s*=\s*["']([^"']+)["']/i)?.[1];
    if (!href) continue;
    try {
      const url = new URL(href, index);
      if (url.origin === "https://research-and-innovation.ec.europa.eu" && !url.username && !url.password &&
          /^\/document\/download\/[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}_en$/i.test(url.pathname)) {
        links.add(url.origin + url.pathname);
      }
    } catch { /* Ignore invalid links. */ }
  }
  if (links.size !== 1) throw new Error(`Güncel çalışma programı bağlantısı tekil olarak bulunamadı: ${section}`);
  return [...links][0];
}
