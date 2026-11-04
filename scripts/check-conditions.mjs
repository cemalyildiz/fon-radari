import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { calls } from '../app/calls-data.ts';
const target = 'public/conditions.json';
const previous = await readFile(target,'utf8').then(JSON.parse).catch(()=>({}));
const result = {...previous};
for (const call of calls) {
  try {
    const response = await fetch(call.sourceUrl,{signal:AbortSignal.timeout(30000)});
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    if (!response.headers.get('content-type')?.includes('text/html')) throw new Error('PDF metni ayrıca doğrulanmalı');
    const html = await response.text();
    const main = html.match(/<main\b[^>]*>([\s\S]*?)<\/main>/i)?.[1] ?? html;
    const text = main.replace(/<(script|style|nav|footer)\b[^>]*>[\s\S]*?<\/\1>/gi,'').replace(/<[^>]+>/g,'\n').replace(/&nbsp;/g,' ').replace(/&amp;/g,'&').split('\n').map(s=>s.replace(/\s+/g,' ').trim()).filter(Boolean);
    const excerpts = text.filter(s=>s.length>30 && s.length<1800 && /başvur|destek oran|üst limit|milyon|hibe|geri ödeme|uygun|eligible|funding|deadline|applicant/i.test(s)).slice(0,35);
    if (excerpts.length<2) throw new Error('Yeterli koşul metni alınamadı');
    const hash = createHash('sha256').update(excerpts.join('\n')).digest('hex');
    result[call.id]={checkedAt:new Date().toISOString(),sourceUrl:call.sourceUrl,excerpts,hash,changed:previous[call.id]?.hash ? previous[call.id].hash!==hash : false,ok:true};
  } catch(e) { result[call.id]={...previous[call.id],ok:false,error:e.message}; }
}
await writeFile(target,JSON.stringify(result,null,2)+'\n');
