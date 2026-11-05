import { readFile, writeFile } from 'node:fs/promises';
import { calls } from '../app/calls-data.ts';
import { verificationCoverage } from '../app/verification-utils.ts';
const verified = JSON.parse(await readFile('public/verified-conditions.json','utf8'));
const records = calls.map(call => {
  const review = verified[call.id] ?? {};
  const merged = {...call,...review};
  return { id: call.id, title: call.title, source: merged.evidenceUrl ?? call.sourceUrl, ...verificationCoverage(merged) };
});
await writeFile('public/verification-audit.json', JSON.stringify({ records, total: records.length, complete: records.filter(r=>r.complete).length },null,2)+'\n');
console.log(`${records.length} kayıt; tüm temel alanları doğrulanan: ${records.filter(r=>r.complete).length}. Eksikler public/verification-audit.json içinde.`);
