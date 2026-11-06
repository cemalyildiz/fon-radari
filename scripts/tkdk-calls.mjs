// The index labels the download links "İndir"; use the title in the same block.
export function extractTkdkCallLinks(html) {
  const rows = [...html.matchAll(/<h4\b[^>]*>([^<]*IPARD\s+III\s+(\d+)\.[^<]*)<\/h4>\s*<a\b[^>]*href=["']([^"']+)["']/gi)];
  const latest = Math.max(...rows.map(row => Number(row[2])));
  return rows.filter(row => Number(row[2]) === latest).map(row => [row[0], row[3], row[1]]);
}
