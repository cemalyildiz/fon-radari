import { readFile, writeFile } from 'node:fs/promises';
import { calls } from '../app/calls-data.ts';
const verified = JSON.parse(await readFile('public/verified-conditions.json','utf8'));
const required = ['applicants','companyScale','fundingAmount','fundingType','supportRate','duration','application'];
const records = calls.map(call => {
  const review = verified[call.id] ?? {};
  const fields = review.verifiedFields ?? [];
  const missing = required.filter(field => !fields.includes(field));
  return { id: call.id, title: call.title, source: review.evidenceUrl ?? call.sourceUrl, verifiedFields: fields, pendingFields: missing, complete: missing.length === 0 };
});
await writeFile('public/verification-audit.json', JSON.stringify({ records, total: records.length, complete: records.filter(r=>r.complete).length },null,2)+'\n');
console.log(`${records.length} kayıt; tüm temel alanları doğrulanan: ${records.filter(r=>r.complete).length}. Eksikler public/verification-audit.json içinde.`);
