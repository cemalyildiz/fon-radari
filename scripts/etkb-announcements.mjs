const archive = 'https://duyuru.enerji.gov.tr/medya-duyurular-liste';
export const energyArchivePages = [archive, ...[2,3,4].map(page => `${archive}?p=${page}`)];

export function energyArchiveLinks(html, page) {
  const links = [];
  for (const [, href, body] of html.matchAll(/<a\b[^>]*\bhref\s*=\s*["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi)) {
    try {
      const url = new URL(href.replace(/&amp;/g, '&'), page);
      if (url.protocol !== 'https:' || !/^(?:duyuru\.|www\.)?enerji\.gov\.tr$/.test(url.hostname) ||
          url.username || url.password || url.port || url.pathname !== '/duyuru-detay' || url.searchParams.size !== 1 ||
          !/^\d+$/.test(url.searchParams.get('id') ?? '')) continue;
      links.push([null, url.href, body]);
    } catch { /* Ignore malformed navigation links. */ }
  }
  if (!links.length) throw new Error('Bakanlık arşivinde duyuru bağlantısı okunamadı');
  return links;
}

export async function fetchEnver(url, request = fetch) {
  for (let attempt = 0; ; attempt++) {
    try {
      return await request(url, {signal:AbortSignal.timeout(12000), headers:{Accept:'application/json'}});
    } catch (error) {
      if (attempt > 0) throw new Error(error.cause?.code ? `Bağlantı hatası (${error.cause.code})` : error.message);
    }
  }
}
