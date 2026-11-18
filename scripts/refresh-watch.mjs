import { readFile, writeFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { programmes, hub, documents, parseRound, classify, noticeStages } from './priority-programmes.mjs';
import { calls } from '../app/calls-data.ts';
const read = async file => JSON.parse(await readFile('public/'+file+'.json','utf8'));
const feed = await read('national-calls'), eu = await read('live-calls'), verified = await read('verified-conditions');
const previous = await read('call-watch').catch(e=>{if(e.code==='ENOENT')return {};throw e});
const checkedAt = new Date().toISOString(), sources={}, alerts=[], rounds={};
const oldSources = previous.sources ?? {};
function health(name,source) {
  const old=oldSources[name], same=old?.attemptedAt===source.attemptedAt;
  const failures=source.ok?0:(old?.failures??0)+(same?0:1);
  sources[name]={...source, checkedAt:source.checkedAt??old?.checkedAt,failures};
  if(failures>=2) alerts.push(name+': art arda '+failures+' başarısız kontrol');
}
async function get(url,limit) {
  const r=await fetch(url,{redirect:'error',signal:AbortSignal.timeout(30000)});
  if(!r.ok || Number(r.headers.get('content-length'))>limit) throw Error('Kaynağa erişilemedi veya belge çok büyük');
  const chunks=[]; let bytes=0;
  for await (const chunk of r.body){bytes+=chunk.length;if(bytes>limit)throw Error('Boyut sınırı');chunks.push(chunk)}
  return Buffer.concat(chunks);
}
for(const [name,source] of Object.entries(feed.sources)) health(name,source);
health('AB Funding & Tenders',{url:'https://ec.europa.eu/info/funding-tenders/opportunities/portal/screen/opportunities/calls-for-proposals',checkedAt:eu.checkedAt,attemptedAt:eu.attemptedAt,ok:!!eu.checkedAt&&!eu.degraded,found:eu.calls.length});
await Promise.all(Object.entries(programmes).map(async ([program,slug])=>{
  const name='TÜBİTAK '+program, url=hub+slug;
  try {
    const docs=documents((await get(url,4e6)).toString(),program);
    if(!docs.length) throw Error('Dönem belgesi bulunamadı');
    for(const doc of docs){
      if(docs.filter(d=>d.key===doc.key).length!==1) throw Error('Aynı dönem için birden fazla belge');
      const pdf=await get(doc.url,16e6);
      if(pdf.subarray(0,5).toString()!=='%PDF-')throw Error('Geçerli PDF alınamadı');
      const hash=createHash('sha256').update(pdf).digest('hex');
      if(program==='1831'){
        if(oldSources[name]?.documentHash && oldSources[name].documentHash!==hash) alerts.push(name+': mentörlük belgesinin içeriği değişti');
        health(name,{url,checkedAt,attemptedAt:checkedAt,ok:true,documentHash:hash,documentUrl:doc.url});
        continue;
      }
      const parsed=parseRound(doc,execFileSync('pdftotext',['-layout','-','-'],{input:pdf,timeout:10000,maxBuffer:4e6}).toString());
      if(!parsed)throw Error(doc.key+': dönem veya takvim satırları doğrulanamadı');
      rounds[doc.key]={...parsed,checkedAt,hash};
    }
    if(program!=='1831') health(name,{url,checkedAt,attemptedAt:checkedAt,ok:true,found:docs.length});
  }catch(e){health(name,{url,attemptedAt:checkedAt,ok:false,error:e.message});alerts.push(name+': '+e.message)}
}));
for(const [key,old] of Object.entries(previous.rounds??{})) if(!rounds[key])rounds[key]={...old,notCurrent:true};
const byId=new Map(calls.map(c=>[c.id,{...c,...verified[c.id]}]));
const calendar = new Map((feed.calendars??[]).filter(c=>!c.notCurrent && feed.sources['TÜBİTAK çağrı takvimi']?.ok && c.checkedAt===feed.attemptedAt).map(c=>[c.key,c]));
const localDay=s=>s?.endsWith('Z')?new Date(Date.parse(s)+10800000).toISOString().slice(0,10):s?.slice(0,10);
const noticeLinks=new Map();
for(const c of feed.calls.filter(c=>/^https:\/\/tubitak\.gov\.tr\/tr\/duyuru\//.test(c.sourceUrl) && classify(c.title)==='Değişiklik' && /\b(?:1501|1507|1707|1832)\b/.test(c.title))){
  try{
    const stages=noticeStages((await get(c.sourceUrl,4e6)).toString());
    if(!stages.length)alerts.push('Dönem ve aşama eşleştirilemedi: '+c.title);
    for(const {key,field,value} of stages){
      const r=rounds[key];if(!r || r.notCurrent)continue;
      if(!noticeLinks.has(c.sourceUrl))noticeLinks.set(c.sourceUrl,new Set());
      noticeLinks.get(c.sourceUrl).add('tubitak-'+key);
      const day=localDay(r[field]);
      if(day===value)continue;
      const cal=calendar.get(key);
      if(value>day && ((field==='deadline' && localDay(cal?.deadline)===value) || (field==='preDeadline' && value<=localDay(r.deadline)))){
        r[field]=field==='deadline'?cal.deadline:value;
        r.stageUrls={...r.stageUrls,[field]:c.sourceUrl};
      }else{r.conflict=true;alerts.push(key+': uzatma duyurusu dönem belgesiyle uyuşmuyor')}
    }
  }catch{alerts.push('Uzatma duyurusu okunamadı: '+c.title)}
}
for(const row of Object.values(rounds)){
  if(row.notCurrent)continue;
  const old=previous.rounds?.[row.key], base=byId.get('tubitak-'+row.key), cal=calendar.get(row.key);
  const baseline=old?.conflict?old.lastAccepted:old;
  row.noticeUrls=[...noticeLinks].filter(([,ids])=>ids.has('tubitak-'+row.key)).map(([url])=>url);
  if(old?.hash && old.hash!==row.hash)row.conditionsChangedAt=checkedAt;
  else if(old?.conditionsChangedAt)row.conditionsChangedAt=old.conditionsChangedAt;
  if(row.conditionsChangedAt && !(Date.parse(base?.verifiedAt??'')>=Date.parse(row.conditionsChangedAt)))alerts.push(row.key+': dönem belgesi değişti; mali ve idari koşulları yeniden inceleyin');
  row.changes=[...(old?.changes??[])];
  for(const field of ['openDate','preDeadline','deadline']){
    if(field!=='openDate' && localDay(row[field])<localDay(baseline?.[field]??base?.[field])){
      row.conflict=true;alerts.push(row.key+': önceki onaylı tarihten erken '+field+'; yeni değişiklik incelenmeli');
    }
    if(cal?.[field] && (localDay(cal[field])!==localDay(row[field]) || (row[field].includes('T') && Date.parse(cal[field])!==Date.parse(row[field])))){
      row.conflict=true; alerts.push(row.key+': dönem belgesi ve takvim uyuşmuyor ('+field+')');
    }else if(cal?.[field] && !row[field].includes('T')) row[field]=cal[field];
    const before=baseline?.[field]??base?.[field];
    if(before && (localDay(before)!==localDay(row[field]) || (before.includes('T') && row[field].includes('T') && Date.parse(before)!==Date.parse(row[field]))) && !row.conflict){
      row.changes.push({field,before,after:row[field],url:row.stageUrls?.[field]??row.url,checkedAt});
    }
  }
  if(row.conflict){row.changes=old?.changes??[];row.lastAccepted=old?.lastAccepted??(old&&!old.conflict?{openDate:old.openDate,deadline:old.deadline,preDeadline:old.preDeadline}:undefined)}
}
const known=new Map();
for(const c of byId.values())for(const url of [c.sourceUrl,c.calendarSourceUrl,c.evidenceUrl,...(c.additionalEvidence??[])])if(url){const ids=known.get(url)??[];ids.push(c.id);known.set(url,[...new Set(ids)])}
const oldQueue=new Map((previous.queue??[]).map(x=>[x.url,x]));
const queue=feed.calls.map(c=>{
  const url=c.sourceUrl, linked=[...new Set([...(known.get(url)??[]),...(noticeLinks.get(url)??[])])], kind=classify(c.title);
  const firstSeen=oldQueue.get(url)?.firstSeen??checkedAt;
  return {title:c.title,url,institution:c.institutionShort,kind,linked,firstSeen,
    action:linked.length?'Mevcut kayda bağlı':kind==='Çağrı değil'?'Çağrı listesinden ayrıldı':'Resmî koşullar incelenmeli'};
});
const overdue=queue.filter(x=>!x.linked.length&&x.kind!=='Çağrı değil'&&Date.parse(checkedAt)-Date.parse(x.firstSeen)>86400000);
if(overdue.length)alerts.push(overdue.length+' duyuru 24 saatten uzun süredir inceleme bekliyor');
await writeFile('public/call-watch.json',JSON.stringify({checkedAt,sources,rounds,queue,alerts},null,2)+'\n');
console.log(Object.keys(rounds).length+' dönem; '+queue.length+' sınıflandırılmış duyuru.',alerts);
