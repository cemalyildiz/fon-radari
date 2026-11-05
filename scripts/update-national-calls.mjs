import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { calls } from '../app/calls-data.ts';
import { calendarIndex, confirmCalendarDetail, extractCalendarIndex } from './tubitak-calendar.mjs';

const path = 'public/national-calls.json';
const previous = await readFile(path, 'utf8').then(JSON.parse).catch(() => ({ calls: [], sources: {} }));
const now = new Date().toISOString();
const sources = [
  ['TÜBİTAK', 'https://tubitak.gov.tr/tr/duyuru'],
  ['KOSGEB', 'https://www.kosgeb.gov.tr/site/tr/genel/duyurular'],
  ['Ticaret Bakanlığı', 'https://ticaret.gov.tr/duyurular'],
  ['HIT-30', 'https://hit30.sanayi.gov.tr/cagrilar'],
  ['SSB', 'https://arge.ssb.gov.tr/'],
];
const clean = value => value.replace(/<[^>]*>/g, ' ').replace(/&amp;/g, '&').replace(/&#\d+;/g, ' ').replace(/\s+/g, ' ').trim();
const records = new Map(previous.calls.map(c => [c.sourceUrl, c]));
const state = { ...previous.sources };
let calendars = previous.calendars ?? [];
try {
  const response = await fetch(calendarIndex, {signal: AbortSignal.timeout(20000)});
  if (!response.ok || response.url !== calendarIndex) throw new Error(`Takvim sayfası okunamadı (${response.status})`);
  const rows = extractCalendarIndex(await response.text());
  if (!rows.length) throw new Error('Doğrulanabilir kod ve takvim içeren satır bulunamadı');
  const checked = await Promise.all(rows.map(async row => {
    try {
      const detail = await fetch(row.sourceUrl, {signal: AbortSignal.timeout(20000)});
      if (!detail.ok || detail.url !== row.sourceUrl || !confirmCalendarDetail(row, await detail.text())) return;
      return {...row, checkedAt: now};
    } catch {
      return undefined;
    }
  }));
  const priorUrls = new Map(calendars.map(row => [row.key, row.sourceUrl]));
  const matches = checked.filter(row => row && (!priorUrls.has(row.key) || priorUrls.get(row.key) === row.sourceUrl));
  calendars = [...new Map([
    ...calendars.map(row => [row.key, {...row, notCurrent:true}]),
    ...matches.map(row => [row.key, row]),
  ]).values()];
  if (!matches.length) throw new Error('Liste ve çağrı ayrıntısında aynı takvim bulunamadı');
  state['TÜBİTAK çağrı takvimi'] = {url: calendarIndex, checkedAt: now, attemptedAt: now, ok: true, found: matches.length, unmatched: rows.length - matches.length};
  console.log(`TÜBİTAK takvimi: ${matches.length}/${rows.length} çağrı ayrıntısıyla eşleşti.`);
} catch (error) {
  state['TÜBİTAK çağrı takvimi'] = {...state['TÜBİTAK çağrı takvimi'], url: calendarIndex, attemptedAt: now, ok: false, error: error.message};
  console.warn(`TÜBİTAK takvimi: ${error.message}`);
}
for (const [institution, url] of sources) {
  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(45000), headers: { 'User-Agent': 'FonRadari/1.0 official funding announcement monitor' } });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const html = await response.text();
    if (html.length < 1000 || /captcha|access denied/i.test(html)) throw new Error('Kaynak okunamadı');
    let found = 0;
    for (const match of html.matchAll(/<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi)) {
      const title = clean(match[2]);
      if (title.length < 25 || !/çağrı|destek|hibe|başvuru|finansman/i.test(title)) continue;
      const link = new URL(match[1], url);
      if (link.origin !== new URL(url).origin || !/^https?:$/.test(link.protocol)) continue;
      link.hash = '';
      const sourceUrl = link.href;
      if (calls.some(c => c.sourceUrl === sourceUrl)) continue;
      const old = records.get(sourceUrl);
      records.set(sourceUrl, { ...old, id: old?.id ?? `national-auto-${createHash('sha256').update(sourceUrl).digest('hex').slice(0,16)}`, scope: 'national', code: 'Resmî duyuru', title, institution, institutionShort: institution, status: 'unknown', openDate: '', recordType: 'program', verification: 'metadata', sourceCheckedAt: now, verifiedAt: '', applicants: 'Resmî çağrı metninden doğrulanmalı', companyScale: [], fundingAmount: 'Resmî çağrı metninden doğrulanmalı', fundingType: 'Doğrulanmalı', summary: 'Resmî kurum sayfasında otomatik keşfedilen duyuru. Başvuru takvimi, uygunluk ve destek koşulları kaynak metinden kontrol edilmelidir.', objectives: [], eligibleCosts: [], application: 'Kaynak bağlantısından güncel çağrı metnini inceleyin.', sourceUrl, sourceLabel: 'Resmî kurum duyurusu', tags: ['Otomatik keşif'], notice: 'Duyurunun bulunması başvurunun açık olduğu anlamına gelmez.' });
      found++;
    }
    if (!found) throw new Error('Uygun duyuru bağlantısı bulunamadı; sayfa yapısı kontrol edilmeli');
    state[institution] = { url, checkedAt: now, attemptedAt: now, ok: true, found };
  } catch (error) {
    state[institution] = { ...state[institution], url, attemptedAt: now, ok: false, error: error.message };
    console.warn(`${institution}: ${error.message}`);
  }
}
await writeFile(path, JSON.stringify({ attemptedAt: now, sources: state, calls: [...records.values()], calendars }, null, 2) + '\n');
