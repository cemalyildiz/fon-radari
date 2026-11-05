import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { pathToFileURL } from 'node:url';

const fingerprint = value => createHash('sha256').update(value).digest('hex');

export function evidenceState(previous, hash, checkedAt, documentHash) {
  const baselineHash = previous?.baselineHash ?? hash;
  const baselineDocumentHash = previous?.baselineDocumentHash ?? documentHash;
  const documentsChanged = baselineDocumentHash !== documentHash;
  return { baselineHash, hash, baselineDocumentHash, documentHash, checkedAt, ok: true, documentsChanged, changed: hash !== baselineHash || documentsChanged };
}
function mainContent(html) {
  const main = html.match(/<main\b[^>]*>([\s\S]*?)<\/main>/i)?.[1] ?? html;
  return main.replace(/<(script|style|nav|footer)\b[^>]*>[\s\S]*?<\/\1>/gi,'');
}
export function contentHash(bytes, type) {
  if (type.includes('pdf')) return fingerprint(bytes);
  const html = new TextDecoder().decode(bytes);
  if (/access denied|erişim engellendi|captcha challenge/i.test(html)) throw new Error('Kaynak erişim engeli');
  const stable = mainContent(html).replace(/<[^>]*>/g,' ').replace(/\s+/g,' ').trim();
  if (stable.length < 200) throw new Error('Yetersiz kaynak içeriği');
  return fingerprint(stable);
}
export function documentLinksHash(bytes, type, pageUrl) {
  if (type.includes('pdf')) return undefined;
  const documents = new Set();
  const html = mainContent(new TextDecoder().decode(bytes));
  for (const [, href] of html.matchAll(/<a\b[^>]*\s+href\s*=\s*["']([^"']+)["']/gi)) {
    try {
      const url = new URL(href.replace(/&amp;|&#38;/gi, '&'), pageUrl);
      if (url.protocol !== 'https:' || url.username || url.password || !/\.(?:pdf|docx?|xlsx?|zip)$/i.test(url.pathname)) continue;
      url.hash = '';
      for (const key of [...url.searchParams.keys()]) {
        if (/^(?:utm_.*|fbclid|gclid|trk)$/i.test(key)) url.searchParams.delete(key);
      }
      url.searchParams.sort();
      documents.add(url.href);
    } catch {
      // Unresolvable links are not valid document references.
    }
  }
  return fingerprint(JSON.stringify([...documents].sort()));
}
async function run() {
  const reviews = JSON.parse(await readFile('public/verified-conditions.json','utf8'));
  const target = 'public/evidence-status.json';
  const previous = await readFile(target,'utf8').then(JSON.parse).catch(()=>({}));
  const urls = [...new Set(Object.values(reviews).flatMap(r=>[r.evidenceUrl,...(r.additionalEvidence ?? [])]).filter(Boolean))];
  const result = {};
  let cursor = 0;
  await Promise.all(Array.from({length:4}, async()=>{
    while(cursor < urls.length) {
      const url = urls[cursor++];
      const attemptedAt = new Date().toISOString();
      try {
        const parsed = new URL(url);
        if(parsed.protocol !== 'https:') throw new Error('HTTPS gerekli');
        const response = await fetch(url,{signal:AbortSignal.timeout(25000)});
        if(!response.ok) throw new Error(`HTTP ${response.status}`);
        const bytes = new Uint8Array(await response.arrayBuffer());
        const type = response.headers.get('content-type') ?? '';
        result[url] = evidenceState(previous[url],contentHash(bytes,type),attemptedAt,documentLinksHash(bytes,type,response.url || url));
      } catch(error) { result[url] = {...previous[url],ok:false,attemptedAt,error:error.message}; }
    }
  }));
  await writeFile(target,JSON.stringify(result,null,2)+'\n');
  console.log(`${urls.length} dayanak izlendi; ${Object.values(result).filter(r=>!r.ok || r.changed).length} kaynak kontrol bekliyor.`);
}
if(process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) await run();
