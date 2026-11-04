import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { calls } from '../app/calls-data.ts';
import { audienceOptions, matchesAudience, privateSectorPriority } from '../app/audience-utils.ts';

const reviews = JSON.parse(await readFile(new URL('../public/verified-conditions.json', import.meta.url), 'utf8'));
const records = calls.map(call => ({ ...call, ...reviews[call.id] }));

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
