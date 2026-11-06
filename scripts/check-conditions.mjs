import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { pathToFileURL } from 'node:url';
import { calls } from '../app/calls-data.ts';

async function readConditions(url, fetchPage) {
  try {
    const response = await fetchPage(url,{signal:AbortSignal.timeout(30000)});
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    if (!response.headers.get('content-type')?.includes('text/html')) throw new Error('PDF metni ayrıca doğrulanmalı');
    const html = await response.text();
    const main = html.match(/<main\b[^>]*>([\s\S]*?)<\/main>/i)?.[1] ?? html;
    const text = main.replace(/<(script|style|nav|footer)\b[^>]*>[\s\S]*?<\/\1>/gi,'').replace(/<[^>]+>/g,'\n').replace(/&nbsp;/g,' ').replace(/&amp;/g,'&').split('\n').map(s=>s.replace(/\s+/g,' ').trim()).filter(Boolean);
    const excerpts = text.filter(s=>s.length>30 && s.length<1800 && /başvur|destek oran|üst limit|milyon|hibe|geri ödeme|uygun|eligible|funding|deadline|applicant/i.test(s)).slice(0,35);
    if (excerpts.length<2) throw new Error('Yeterli koşul metni alınamadı');
    const hash = createHash('sha256').update(excerpts.join('\n')).digest('hex');
    return {checkedAt:new Date().toISOString(),sourceUrl:url,excerpts,hash,ok:true};
  } catch(e) { return {ok:false,error:e.message}; }
}

// Sites with slow responses should not block independent institutions. Within
// each host, fetch serially, and reuse a page shared by multiple call records.
export async function refreshConditions(records, previous, fetchPage = fetch) {
  const groups = new Map();
  for (const {sourceUrl} of records) {
    const host = new URL(sourceUrl).hostname.toLowerCase().replace(/^www\./, '');
    if (!groups.has(host)) groups.set(host, new Set());
    groups.get(host).add(sourceUrl);
  }
  const queues = [...groups.values()].sort((a,b) => b.size - a.size);
  const observations = new Map();
  let next = 0;
  await Promise.all(Array.from({length: Math.min(6, queues.length)}, async () => {
    while (next < queues.length) {
      for (const url of queues[next++]) observations.set(url, await readConditions(url, fetchPage));
    }
  }));
  const result = {...previous};
  for (const {id, sourceUrl} of records) {
    const observation = observations.get(sourceUrl);
    result[id] = observation.ok
      ? {...observation, changed: Boolean(previous[id]?.hash && previous[id].hash !== observation.hash)}
      : {...previous[id], ...observation};
  }
  return result;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const target = 'public/conditions.json';
  const previous = await readFile(target,'utf8').then(JSON.parse).catch(()=>({}));
  await writeFile(target, JSON.stringify(await refreshConditions(calls, previous), null, 2)+'\n');
}
