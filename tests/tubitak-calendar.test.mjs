import test from 'node:test';
import assert from 'node:assert/strict';
import { extractCalendarIndex, confirmCalendarDetail, listedMentoring1831 } from '../scripts/tubitak-calendar.mjs';
import { mergeMentoring1831Intake, mergeNationalCalendars, realStatus } from '../app/call-utils.ts';

const path = '/tr/destekler/destek/sanayi/ulusal-destek-programlari/cagri-1707-siparis-ar-ge-2026-yili-3-cagrisi-acildi';
const dates = '<time datetime="2026-08-31T21:00:00Z">01 Eyl 2026 - 00:00</time> - <time datetime="2026-11-13T20:59:00Z">13 Kas 2026 - 23:59</time>';
const index = (code = '#1707 2026-3', href = path, range = dates) => `<div class="views-row"><div class="c-baslik"><a href="${href}">1707 Sipariş Ar-Ge</a></div><div class="c-kodu">${code}</div><span class="views-label views-label-field-basvuru-araligi">Başvuru aralığı</span><div class="field-content">${range}</div></div>`;
const detail = (code = '1707 2026/3', range = dates) => `<div class="field__label">Çağrı kodu</div><div class="field__item">${code}</div><div class="field__label">Başvuru aralığı</div><div class="field__item">${range}</div>`;

test('1831 can be listed without publishing the distant portal end date', () => {
  const start = '<time datetime="2024-05-15T21:00:00Z">16 May 2024 - 00:00</time>';
  const end = '<time datetime="2030-01-01T20:59:00Z">01 Oca 2030 - 23:59</time>';
  const row = index('#', path.replace('1707-siparis-ar-ge-2026-yili-3-cagrisi-acildi','1831-yesil-inovasyon-teknoloji-mentorluk-cagrisi'), start + ' - ' + end)
    .replace('1707 Sipariş Ar-Ge','1831 Yeşil İnovasyon Teknoloji Mentörlük Çağrısı');
  const now = Date.parse('2026-11-06T19:00:00Z');
  assert.equal(listedMentoring1831(row, now),true);
  assert.equal(listedMentoring1831(row + row, now),false);
  assert.equal(listedMentoring1831(row.replace('Oca','Kas'), now),false);
  assert.equal(listedMentoring1831(row, Date.parse('2030-01-02')),false);
  assert.deepEqual(extractCalendarIndex(row),[]);
  const base = {id:'tubitak-1831-continuous', status:'unknown', applicationType:'continuous', openDate:'2024-05-16'};
  const observation = {listed:true, ok:true, checkedAt:new Date(now).toISOString()};
  const accepted = mergeMentoring1831Intake(base,observation,now);
  assert.equal(accepted.deadline,undefined);
  assert.equal(realStatus(accepted,now),'open');
  assert.equal(realStatus(accepted,now + 49 * 3600000),'unknown');
  assert.equal(mergeMentoring1831Intake(base,{...observation,listed:false},now).status,'unknown');
});

test('checks the exact code, dates and timezone on both official pages', () => {
  const [row] = extractCalendarIndex(index());
  assert.equal(row.key, '1707-2026-3');
  assert.equal(row.deadline, '2026-11-13T20:59:00Z');
  assert.equal(confirmCalendarDetail(row, detail()), true);
  assert.equal(confirmCalendarDetail(row, detail('1707 2026-2')), false);
  assert.equal(confirmCalendarDetail(row, detail(undefined, dates.replace('23:59','20:59'))), false);
});
test('ignores placeholders, duplicated codes, spoofed links and invalid display dates', () => {
  assert.deepEqual(extractCalendarIndex(index('#')), []);
  assert.deepEqual(extractCalendarIndex(index() + index()), []);
  assert.deepEqual(extractCalendarIndex(index(undefined, 'https://tubitak.gov.tr.example.org'+path)), []);
  assert.deepEqual(extractCalendarIndex(index(undefined, path, dates.replace('Kas','Ara'))), []);
});
test('matching source never invents eligibility and discrepancies do not silently reopen a reviewed record', () => {
  const now = Date.parse('2026-11-05T10:00:00Z');
  const row = { ...extractCalendarIndex(index())[0], checkedAt:'2026-11-05T09:00:00Z' };
  const previous = { id:'tubitak-1707-2026-3', scope:'national', status:'archived', calendarSourceUrl:row.sourceUrl, openDate:row.openDate, deadline:'2026-10-30T20:59:00Z' };
  const {updated,discovered} = mergeNationalCalendars([previous], [row], now);
  assert.equal(discovered.length,0);
  assert.equal(realStatus(updated[0],now),'unknown');
  assert.equal(updated[0].calendarObservation.conflict,true);
  assert.equal(updated[0].deadline,previous.deadline);
  const [unreviewed] = mergeNationalCalendars([], [row], now).discovered;
  assert.equal(unreviewed.verification,'metadata');
  assert.equal(unreviewed.applicantGroups,undefined);
  assert.equal(realStatus(unreviewed,now),'open');
  assert.equal(realStatus(mergeNationalCalendars([], [{...row,notCurrent:true}], now).discovered[0],now),'unknown');
  assert.equal(realStatus(unreviewed,Date.parse('2026-11-14T10:00:00Z')),'archived');
});
