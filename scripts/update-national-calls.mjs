import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { calls } from '../app/calls-data.ts';
import { enverAnnouncementLinks, isNationalFundingCandidate, nationalAnnouncementKey } from '../app/national-announcements.mjs';
import { calendarIndex, confirmCalendarDetail, extractCalendarIndex, listedMentoring1831 } from './tubitak-calendar.mjs';
import { extractTkdkCallLinks } from './tkdk-calls.mjs';
import { energyArchiveLinks, energyArchivePages, fetchEnver } from './etkb-announcements.mjs';

const path = 'public/national-calls.json';
const previous = await readFile(path, 'utf8').then(JSON.parse).catch(() => ({ calls: [], sources: {} }));
const now = new Date().toISOString();
const sources = [
  ['TÜBİTAK', 'https://tubitak.gov.tr/tr/duyuru'],
  ['KOSGEB', 'https://kosgeb.gov.tr/site/tr/genel/liste/4/haber'],
  ['DOĞAKA', 'https://www.dogaka.gov.tr/duyurular'],
  ['Ticaret Bakanlığı', 'https://ticaret.gov.tr/duyurular'],
  ['HIT-30', 'https://hit30.sanayi.gov.tr/cagrilar'],
  ['SSB', 'https://arge.ssb.gov.tr/'],
  ['TKDK', 'https://www.tkdk.gov.tr/'],
  ['TKDK çağrı ilanları', 'https://www.tkdk.gov.tr/ProjeIslemleri/CagriIlanArsiv'],
  ['Karacadağ Kalkınma Ajansı', 'https://www.karacadag.gov.tr/duyurular/1/duyurular/'],
  ['ETKB · Enerji Verimliliği', 'https://enerjiverimliligi.enerji.gov.tr/Home/GetirDuyurularGuncel'],
  ['ETKB · Bakanlık Duyuru Arşivi', energyArchivePages[0]],
];
const clean = value => value.replace(/<[^>]*>/g, ' ').replace(/&#(x[0-9a-f]+|\d+);/gi, (_, entity) => {
  const point = entity[0].toLowerCase() === 'x' ? parseInt(entity.slice(1), 16) : Number(entity);
  return point > 0 && point <= 0x10ffff ? String.fromCodePoint(point) : ' ';
}).replace(/&amp;/g, '&').replace(/\s+/g, ' ').trim();
const reviewed = new Set(calls.flatMap(c => [c.sourceUrl, c.calendarSourceUrl]).filter(Boolean).map(nationalAnnouncementKey));
const records = new Map(previous.calls.filter(c => !reviewed.has(nationalAnnouncementKey(c.sourceUrl)) && isNationalFundingCandidate(c.title, c.sourceUrl)).map(c => [nationalAnnouncementKey(c.sourceUrl), c]));
const state = { ...previous.sources };
let calendars = previous.calendars ?? [];
let mentoring1831 = {ok:false, listed:false, checkedAt:now};
try {
  const response = await fetch(calendarIndex, {signal: AbortSignal.timeout(20000)});
  if (!response.ok || response.url !== calendarIndex) throw new Error(`Takvim sayfası okunamadı (${response.status})`);
  const html = await response.text();
  const rows = extractCalendarIndex(html);
  const listed = listedMentoring1831(html, Date.parse(now));
  mentoring1831 = {ok: rows.length > 0 || listed, listed, checkedAt:now};
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
    const isEnver = institution === 'ETKB · Enerji Verimliliği';
    const isEnergyArchive = url === energyArchivePages[0];
    let failedPages = 0;
    let anchors;
    if (isEnergyArchive) {
      const pages = await Promise.allSettled(energyArchivePages.map(async page => {
        const response = await fetch(page, {signal:AbortSignal.timeout(12000)});
        if (!response.ok || new URL(response.url).origin !== new URL(page).origin) throw new Error(`HTTP ${response.status}`);
        return energyArchiveLinks(await response.text(), page);
      }));
      failedPages = pages.filter(page => page.status === 'rejected').length;
      if (failedPages === pages.length) throw new Error('Bakanlık duyuru arşivine erişilemedi');
      anchors = pages.flatMap(page => page.status === 'fulfilled' ? page.value : []);
    } else {
      const response = isEnver ? await fetchEnver(url) :
        await fetch(url, { signal: AbortSignal.timeout(45000), headers: { 'User-Agent': 'FonRadari/1.0 official funding announcement monitor' } });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      if (isEnver) {
        if (response.url !== url) throw new Error('ENVER adresi değişti');
        anchors = enverAnnouncementLinks(await response.json());
      } else {
        const html = await response.text();
        if (html.length < 1000 || /captcha|access denied/i.test(html)) throw new Error('Kaynak okunamadı');
        anchors = institution === 'TKDK çağrı ilanları' ? extractTkdkCallLinks(html) :
          html.matchAll(/<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi);
      }
    }
    let found = 0;
    for (const match of anchors) {
      const title = clean(match[2]);
      if (title.length < 25) continue;
      let link;
      try { link = new URL(match[1], url); } catch { continue; }
      const source = new URL(url);
      if (institution === 'KOSGEB' && link.hostname === 'www.kosgeb.gov.tr') link.hostname = source.hostname;
      if (institution.startsWith('TKDK') && link.hostname === 'tkdk.gov.tr') link.hostname = source.hostname;
      if (!isEnergyArchive && link.origin !== source.origin) continue;
      if (institution === 'DOĞAKA' && link.pathname.startsWith('/duyuru/')) link.pathname = '/tr' + link.pathname;
      link.hash = '';
      const sourceUrl = link.href;
      if (!isNationalFundingCandidate(title, sourceUrl)) continue;
      if (institution === 'Karacadağ Kalkınma Ajansı' && found >= 25) break;
      found++;
      const key = nationalAnnouncementKey(sourceUrl);
      if (reviewed.has(key)) continue;
      const old = records.get(key);
      const issuer = institution.startsWith('TKDK') ? 'TKDK' : institution;
      records.set(key, { ...old, id: old?.id ?? `national-auto-${createHash('sha256').update(key).digest('hex').slice(0,16)}`, scope: 'national', code: 'Resmî duyuru', title, institution: issuer, institutionShort: issuer, status: 'unknown', openDate: '', recordType: 'program', verification: 'metadata', sourceCheckedAt: now, verifiedAt: '', applicants: 'Resmî çağrı metninden doğrulanmalı', companyScale: [], fundingAmount: 'Resmî çağrı metninden doğrulanmalı', fundingType: 'Doğrulanmalı', summary: 'Resmî kurum sayfasında otomatik keşfedilen duyuru. Başvuru takvimi, uygunluk ve destek koşulları kaynak metinden kontrol edilmelidir.', objectives: [], eligibleCosts: [], application: 'Kaynak bağlantısından güncel çağrı metnini inceleyin.', sourceUrl, sourceLabel: 'Resmî kurum duyurusu', tags: ['Otomatik keşif'], notice: 'Duyurunun bulunması başvurunun açık olduğu anlamına gelmez.' });
    }
    if (!found && !isEnergyArchive) throw new Error('Uygun duyuru bağlantısı bulunamadı; sayfa yapısı kontrol edilmeli');
    state[institution] = failedPages
      ? {...state[institution], url, attemptedAt: now, ok: false, found, error: `${failedPages} arşiv sayfası okunamadı`}
      : { url, checkedAt: now, attemptedAt: now, ok: true, found };
  } catch (error) {
    state[institution] = { ...state[institution], url, attemptedAt: now, ok: false, error: error.message };
    console.warn(`${institution}: ${error.message}`);
  }
}
await writeFile(path, JSON.stringify({ attemptedAt: now, sources: state, calls: [...records.values()], calendars, mentoring1831 }, null, 2) + '\n');
