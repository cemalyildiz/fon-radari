import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { calls } from '../app/calls-data.ts';
import { audienceOptions, matchesAudience, privateSectorPriority } from '../app/audience-utils.ts';

const reviews = JSON.parse(await readFile(new URL('../public/verified-conditions.json', import.meta.url), 'utf8'));
const records = calls.map(call => ({ ...call, ...reviews[call.id] }));

test('BiGG individual eligibility does not appear as direct company eligibility', () => {
  const bigg = records.find(call => call.id === 'tubitak-bigg-2026-2');
  const partnership = records.find(call => call.id === 'tubitak-1505-surekli');
  assert.equal(matchesAudience(bigg, 'Girişimci / Bireysel'), true);
  assert.equal(matchesAudience(bigg, 'Özel sektör'), false);
  assert.equal(bigg.deadline, '2026-09-30');
  assert.match(bigg.followUpStages[0].schedule, /8–11 Aralık/);
  assert.equal(matchesAudience(partnership, 'Özel sektör'), true);
  assert.match(partnership.fundingAmount, /2\.300\.000 TL/);
});

test('reviewed Japan and SAYEM records distinguish international deadline and closed national round', () => {
  const japan = records.find(call => call.id === 'eureka-globalstars-japan-2026');
  const sayem = records.find(call => call.id === 'tubitak-1833-2026-1');
  assert.equal(japan.deadline, '2027-01-20T02:00:00+03:00');
  assert.match(japan.followUpStages[0].schedule, /e-postayla/);
  assert.equal(matchesAudience(japan, 'Üniversite / Araştırma'), false);
  assert.equal(sayem.status, 'archived');
  assert.equal(sayem.deadline, '2026-06-04');
  assert.equal(matchesAudience(sayem, 'Özel sektör'), true);
  assert.equal(matchesAudience(sayem, 'Üniversite / Araştırma'), true);
});

test('EIC thematic calls keep company eligibility and planned batches separate from unconfirmed opening', () => {
  const topics = records.filter(call => /^eic-accelerator-challenge-.+-2027$/.test(call.id));
  assert.equal(topics.length, 4);
  assert.deepEqual(topics.map(call => Number(call.fundingAmount.match(/(\d+) milyon € konu bütçesidir/)?.[1])), [30, 50, 20, 50]);
  for (const call of topics) {
    assert.equal(matchesAudience(call, 'Özel sektör'), true);
    assert.equal(call.status, 'unknown');
    assert.equal(call.openDate, '');
    assert.equal(call.deadlines.length, 4);
    assert.ok(!call.verifiedFields.includes('openDate'));
  }
  assert.match(topics.find(call => call.id.includes('fusion')).notice, /THS 4–6/);
});

test('firm support and institutional TTO support appear in different audience views', () => {
  const industrial = records.find(call => call.id === 'tubitak-1507-2026-2');
  const tto = records.find(call => call.id === 'tubitak-1613-ttp');
  assert.equal(matchesAudience(industrial, 'Özel sektör'), true);
  assert.equal(matchesAudience(tto, 'Özel sektör'), false);
  assert.equal(matchesAudience(tto, 'TTO / Arayüz kuruluşu'), true);
  assert.equal(matchesAudience(tto, 'Üniversite / Araştırma'), true);
  assert.equal(matchesAudience(tto, 'Akademisyen'), false);
});

test('mixed consortia can appear in both firm and public institution views', () => {
  const consortium = records.find(call => call.id === 'tubitak-1711-2026');
  assert.equal(matchesAudience(consortium, 'Özel sektör'), true);
  assert.equal(matchesAudience(consortium, 'Kamu kurum / kuruluşu'), true);
  assert.equal(matchesAudience(consortium, 'Üniversite / Araştırma'), true);
});

test('titles, agency names and company scale cannot infer applicant eligibility', () => {
  const unknown = { title: 'ARDEB sanayi KOBİ desteği', institutionShort: 'TÜBİTAK', companyScale: ['KOBİ'] };
  assert.equal(matchesAudience(unknown, 'Özel sektör'), false);
  assert.equal(matchesAudience(unknown, 'Akademisyen'), false);
  assert.equal(matchesAudience(unknown, 'Tümü'), true);
  assert.equal(matchesAudience(unknown, 'Henüz sınıflandırılmamış'), true);
});

test('all assigned audience labels have an inspected applicant condition and official evidence', () => {
  for (const record of records.filter(call => call.applicantGroups?.length)) {
    assert.ok(record.verifiedFields?.includes('applicants'), record.id);
    assert.ok(record.evidenceUrl?.startsWith('https://'), record.id);
    for (const group of record.applicantGroups) assert.ok(audienceOptions.includes(group), group);
  }
});

test('private sector opportunities precede institutional-only opportunities', () => {
  const firm = records.find(call => call.id === 'tubitak-1507-2026-2');
  const tto = records.find(call => call.id === 'tubitak-1613-ttp');
  assert.deepEqual([tto, firm].sort(privateSectorPriority).map(call => call.id), [firm.id, tto.id]);
});

test('unresolved training cap conflict is not marked verified', () => {
  const tto = reviews['tubitak-1613-ttp'];
  assert.ok(tto.verificationIssues.some(issue => issue.field === 'fundingAmount'));
  assert.equal(tto.verifiedFields.includes('fundingAmount'), false);
});

test('verified regional restrictions differ from unknown eligibility', () => {
  const restricted = records.find(call => call.id === 'systemeu-fstp-2026');
  const intermediary = records.find(call => call.id === 'valleys-open-call-1');
  assert.equal(matchesAudience(restricted, 'Türkiye’den fonlanamaz'), true);
  assert.equal(matchesAudience(restricted, 'Özel sektör'), false);
  assert.equal(matchesAudience(restricted, 'Henüz sınıflandırılmamış'), false);
  assert.equal(matchesAudience(intermediary, 'Özel sektör'), true);
  assert.equal(matchesAudience(intermediary, 'TTO / Arayüz kuruluşu'), true);
});
