import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { pathToFileURL } from 'node:url';
import { cluster4Programme, cluster4ProgrammeIndex, listedCluster4Programme, revisionIndexFor } from '../app/programme-revision.mjs';

const fingerprint = value => createHash('sha256').update(value).digest('hex');

export function evidenceState(previous, hash, checkedAt, documentHash, review) {
  const baselineHash = review?.hash ?? previous?.baselineHash ?? hash;
  const baselineDocumentHash = review?.documentHash ?? previous?.baselineDocumentHash ?? documentHash;
  const documentsChanged = baselineDocumentHash !== documentHash;
  return { baselineHash, hash, baselineDocumentHash, documentHash, checkedAt, ok: true, documentsChanged, changed: hash !== baselineHash || documentsChanged };
}
function mainContent(html, scope) {
  let content = html.match(/<main\b[^>]*>([\s\S]*?)<\/main>/i)?.[1] ?? html;
  if (scope === 'tubitak-announcement') {
    const articles = [...content.matchAll(/<article\b[^>]*>([\s\S]*?)<\/article>/gi)];
    const titles = [...content.matchAll(/<h1\b[^>]*>([\s\S]*?)<\/h1>/gi)];
    if (articles.length !== 1 || titles.length !== 1) throw new Error('Çağrı başlığı veya metni sayfada tekil olarak bulunamadı');
    content = titles[0][1] + ' ' + articles[0][1];
  }
  return content.replace(/<(script|style|nav|footer)\b[^>]*>[\s\S]*?<\/\1>/gi,'');
}
const officeDocument = type => /application\/(?:vnd\.openxmlformats-officedocument\.[^;]+|vnd\.ms-excel\.sheet\.macroenabled\.12)(?:;|$)/i.test(type);
const zipDocument = (type, url = '') =>
  /^application\/(?:zip|x-zip-compressed)(?:;|$)/i.test(type) ||
  (/^application\/octet-stream(?:;|$)/i.test(type) && /\.zip(?:[?#]|$)/i.test(url));
export function contentHash(bytes, type, pageUrl, scope) {
  if (type.includes('pdf')) return fingerprint(bytes);
  if (officeDocument(type) || zipDocument(type, pageUrl)) {
    if (bytes[0] !== 0x50 || bytes[1] !== 0x4b || bytes[2] !== 0x03 || bytes[3] !== 0x04) throw new Error('Sıkıştırılmış belge okunamadı');
    return fingerprint(bytes);
  }
  const html = new TextDecoder().decode(bytes);
  if (/access denied|erişim engellendi|captcha challenge/i.test(html)) throw new Error('Kaynak erişim engeli');
  const stable = mainContent(html, scope).replace(/<[^>]*>/g,' ').replace(/\s+/g,' ').trim();
  if (stable.length < 200) throw new Error('Yetersiz kaynak içeriği');
  return fingerprint(stable);
}
export function documentLinksHash(bytes, type, pageUrl, scope) {
  if (type.includes('pdf') || officeDocument(type) || zipDocument(type, pageUrl)) return undefined;
  const documents = new Set();
  const html = mainContent(new TextDecoder().decode(bytes), scope);
  for (const [, href] of html.matchAll(/<a\b[^>]*\s+href\s*=\s*["']([^"']+)["']/gi)) {
    try {
      const url = new URL(href.replace(/&amp;|&#38;/gi, '&'), pageUrl);
      if (url.protocol !== 'https:' || url.username || url.password ||
          (scope !== 'tubitak-announcement' && !/\.(?:pdf|docx?|xlsx?|zip)$/i.test(url.pathname))) continue;
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
export function approvedEvidence(reviews) {
  const result = new Map();
  for (const review of Object.values(reviews)) {
    const urls = [review.evidenceUrl, ...(review.additionalEvidence ?? [])];
    for (const [url, row] of Object.entries(review.reviewedEvidence ?? {})) {
      if (!urls.includes(url) || !/^https:\/\/tubitak\.gov\.tr\/tr\/duyuru\/[a-z0-9-]+$/.test(url) ||
          row?.scope !== 'tubitak-announcement' || !/^[a-f0-9]{64}$/.test(row.hash) ||
          !/^[a-f0-9]{64}$/.test(row.documentHash)) throw new Error(`Geçersiz incelenmiş kaynak: ${url}`);
      const existing = result.get(url);
      if (existing && (existing.hash !== row.hash || existing.documentHash !== row.documentHash)) {
        throw new Error(`Çelişen inceleme kayıtları: ${url}`);
      }
      result.set(url,row);
    }
  }
  return result;
}
export function cluster4RevisionState(bytes, checkedAt) {
  const observed = listedCluster4Programme(new TextDecoder().decode(bytes));
  return { ...evidenceState(undefined, fingerprint(observed), checkedAt, undefined, {hash:fingerprint(cluster4Programme)}), observedProgrammeUrl: observed };
}
async function run() {
  const reviews = JSON.parse(await readFile('public/verified-conditions.json','utf8'));
  const approved = approvedEvidence(reviews);
  const target = 'public/evidence-status.json';
  const previous = await readFile(target,'utf8').then(JSON.parse).catch(()=>({}));
  const urls = [...new Set(Object.values(reviews).flatMap(r=>[r.evidenceUrl,...(r.additionalEvidence ?? []),revisionIndexFor(r.evidenceUrl)]).filter(Boolean))];
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
        if (url === cluster4ProgrammeIndex) {
          result[url] = cluster4RevisionState(bytes, attemptedAt);
          continue;
        }
        const type = response.headers.get('content-type') ?? '';
        const finalUrl = response.url || url;
        const review = approved.get(url);
        if (review && finalUrl !== url) throw new Error('İncelenmiş duyuru adresi değişti');
        result[url] = evidenceState(previous[url],contentHash(bytes,type,finalUrl,review?.scope),attemptedAt,documentLinksHash(bytes,type,finalUrl,review?.scope),review);
      } catch(error) { result[url] = {...previous[url],ok:false,attemptedAt,error:error.message}; }
    }
  }));
  await writeFile(target,JSON.stringify(result,null,2)+'\n');
  console.log(`${urls.length} dayanak izlendi; ${Object.values(result).filter(r=>!r.ok || r.changed).length} kaynak kontrol bekliyor.`);
}
if(process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) await run();
