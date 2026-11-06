import test from 'node:test';
import assert from 'node:assert/strict';
import { approvedEvidence, evidenceState, contentHash, documentLinksHash, cluster4RevisionState } from '../scripts/monitor-evidence.mjs';
import { cluster4Programme, cluster4ProgrammeIndex, revisionIndexFor } from '../app/programme-revision.mjs';
import { readFile } from 'node:fs/promises';
import { evidenceAlerts } from '../app/verification-utils.ts';
import { refreshConditions } from '../scripts/check-conditions.mjs';
test('the programme index detects a newly listed edition before the pinned PDF changes', () => {
  const another = 'https://research-and-innovation.ec.europa.eu/document/download/11111111-2222-3333-4444-555555555555_en';
  const enc = new TextEncoder();
  const anchor = (href, year = '2026-27') => `<a href="${href}" data-untranslated-label="Horizon Europe Work programme (${year}) - Cluster 4">Download</a>`;
  const result = html => cluster4RevisionState(enc.encode(html), '2026-11-06T18:00:00Z');
  assert.equal(revisionIndexFor(cluster4Programme), cluster4ProgrammeIndex);
  assert.equal(revisionIndexFor(another), undefined);
  assert.equal(result(anchor(another, '2025') + anchor(new URL(cluster4Programme).pathname + '?prefLang=de')).changed, false);
  assert.equal(result(anchor(another)).changed, true);
  assert.equal(result(anchor(another)).observedProgrammeUrl, another);
  assert.throws(() => result(anchor(another) + anchor(cluster4Programme)));
  assert.throws(() => result(anchor(another.replace('ec.europa.eu', 'invalid.example'))));
});
test('condition checks reuse shared pages, isolate failed sources, and process distinct hosts in parallel', async () => {
  const shared = 'https://www.one.example/conditions';
  const second = 'https://one.example/other';
  const failed = 'https://two.example/notice';
  const seen = [];
  let release;
  const gate = new Promise(resolve => { release = resolve; });
  const result = await refreshConditions(
    [{id:'a',sourceUrl:shared}, {id:'b',sourceUrl:shared}, {id:'c',sourceUrl:second}, {id:'d',sourceUrl:failed}],
    {b:{hash:'old'}, d:{checkedAt:'old',excerpts:['retained']}},
    async url => {
      seen.push(url);
      if (url === failed) {
        release();
        return new Response('', {status:403});
      }
      if (url === shared) await gate;
      return new Response('<main><p>Başvuru koşullarını açıklayan ayrıntılı resmî metin</p><p>Uygun giderleri açıklayan çağrı metni ve kılavuzu</p></main>', {headers:{'content-type':'text/html'}});
    },
  );
  assert.deepEqual(seen, [shared, failed, second]);
  assert.equal(result.a.hash, result.b.hash);
  assert.equal(result.a.changed, false);
  assert.equal(result.b.changed, true);
  assert.deepEqual(result.d, {ok:false,error:'HTTP 403',checkedAt:'old',excerpts:['retained']});
});
test('changed evidence remains pending across repeated hourly reads',()=>{
  const baseline = evidenceState(undefined,'original','2026-11-04');
  const changed = evidenceState(baseline,'revision','2026-11-05');
  assert.equal(changed.changed,true);
  assert.equal(evidenceState(changed,'revision','2026-11-06').changed,true);
  assert.equal(evidenceState(changed,'original','2026-11-06').changed,false);
});
test('reviewed TÜBİTAK announcements ignore neighbouring headlines but detect a new deadline or application link', async()=>{
  const url = 'https://tubitak.gov.tr/tr/duyuru/eureka-smart-kumesi-10-cagrisi-acildi';
  const scope = 'tubitak-announcement';
  const kind = 'text/html';
  const snapshot = (headline, date, link) => {
    const bytes = new TextEncoder().encode(`<main><h1>SMART</h1><article><p>${'Başvuru koşulu. '.repeat(20)}Kapanış: ${date}</p><a href="${link}">Başvuru</a></article><aside><a href="/other.pdf">${headline}</a></aside></main>`);
    return {scope, hash:contentHash(bytes,kind,url,scope), documentHash:documentLinksHash(bytes,kind,url,scope)};
  };
  const review = snapshot('Komşu haber A','26 Ocak','/apply');
  assert.deepEqual(snapshot('Komşu haber B','26 Ocak','/apply'),review);
  const old = { baselineHash:'old-page', baselineDocumentHash:'old-links' };
  const accepted = evidenceState(old,review.hash,'2026-11-06',review.documentHash,review);
  assert.equal(accepted.changed,false);
  const revised = snapshot('Komşu haber A','30 Ocak','/apply');
  assert.equal(evidenceState(accepted,revised.hash,'2026-11-07',revised.documentHash,review).changed,true);
  const replacement = snapshot('Komşu haber A','26 Ocak','/new-apply');
  assert.equal(evidenceState(accepted,replacement.hash,'2026-11-07',replacement.documentHash,review).documentsChanged,true);
  assert.throws(()=>contentHash(new TextEncoder().encode('<main><h1>SMART</h1></main>'),kind,url,scope));
  assert.throws(()=>approvedEvidence({wrong:{evidenceUrl:'https://other.example',reviewedEvidence:{[url]:review}}}));
  const config = JSON.parse(await readFile(new URL('../public/verified-conditions.json',import.meta.url),'utf8'));
  assert.ok(approvedEvidence(config).has(url));
});
test('an access denied page cannot replace a valid evidence fingerprint',()=>{
  assert.throws(()=>contentHash(new TextEncoder().encode('<main>Erişim engellendi</main>'),'text/html'));
});
test('an official Office document is monitored as a binary file, not as HTML',()=>{
  const kind = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
  const old = Uint8Array.of(0x50,0x4b,3,4,5);
  const replacement = Uint8Array.of(0x50,0x4b,3,4,6);
  assert.notEqual(contentHash(old,kind),contentHash(replacement,kind));
  assert.equal(documentLinksHash(old,kind,'https://example.org/limits.xlsx'),undefined);
  assert.throws(()=>contentHash(new TextEncoder().encode('<html>not a workbook</html>'),kind));
});
test('a replaced call document is detected even when the announcement text is unchanged',()=>{
  const page = path => new TextEncoder().encode(`<main><p>${'Resmî çağrı duyurusu. '.repeat(15)}</p><a href="${path}">Çağrı metni</a></main>`);
  const kind = 'text/html';
  const url = 'https://example.org/calls/announcement';
  const original = page('/docs/call.pdf');
  const revised = page('/docs/call-revised.pdf');
  const text = contentHash(original, kind);
  assert.equal(contentHash(revised, kind),text);
  const old = evidenceState(undefined,text,'2026-11-04');
  const baseline = evidenceState(old,text,'2026-11-05',documentLinksHash(original,kind,url));
  assert.equal(baseline.changed,false);
  const changed = evidenceState(baseline,text,'2026-11-06',documentLinksHash(revised,kind,url));
  assert.equal(changed.changed,true);
  assert.equal(changed.documentsChanged,true);
  assert.equal(evidenceState(changed,text,'2026-11-07',documentLinksHash(revised,kind,url)).changed,true);
  assert.equal(evidenceState(changed,text,'2026-11-08',documentLinksHash(original,kind,url)).changed,false);
});
test('a ZIP application guide changed at the same URL triggers a source warning',()=>{
  const url = 'https://example.org/guide.zip';
  const old = Uint8Array.of(0x50,0x4b,3,4,5);
  const next = Uint8Array.of(0x50,0x4b,3,4,6);
  const initial = evidenceState(undefined,contentHash(old,'application/zip',url),'2026-11-05');
  const revised = evidenceState(initial,contentHash(next,'application/octet-stream',url),'2026-11-06');
  assert.equal(revised.changed,true);
  assert.equal(documentLinksHash(next,'application/octet-stream',url),undefined);
  assert.throws(()=>contentHash(new TextEncoder().encode('<html>maintenance</html>'),'application/zip',url));
});
test('document link tracking ignores fragments, marketing parameters, repeated links and navigation',()=>{
  const digest = html => documentLinksHash(new TextEncoder().encode(html),'text/html','https://example.org/calls/');
  const clean = digest('<main><a href="../docs/call.pdf?rev=2">Metin</a></main>');
  assert.equal(digest('<main><nav><a href="/newsletter.pdf">Menu</a></nav><a href="/docs/call.pdf?utm_source=email&amp;rev=2#page=1">Metin</a><a href="/docs/call.pdf?rev=2">Yine</a></main>'),clean);
  assert.notEqual(digest('<main><a href="/docs/call.pdf?rev=3">Metin</a></main>'),clean);
});
test('warning identifies the precise source and distinguishes changed, failed and stale evidence',()=>{
  const now = Date.parse('2026-11-05T12:00:00Z');
  const checkedAt = '2026-11-05T10:00:00Z';
  const observations = {
    fresh: { ok:true, checkedAt },
    removed: { ok:false, checkedAt, documentsChanged:true },
    link: { ok:true, checkedAt, documentsChanged:true },
    text: { ok:true, checkedAt, changed:true },
    stale: { ok:true, checkedAt:'2026-11-01' },
    invalid: { ok:true, checkedAt:'unknown' },
  };
  assert.deepEqual(evidenceAlerts(['fresh','removed','link','text','stale','invalid','missing','link'],observations,now),[
    {url:'removed', reason:'Son taramada kaynağa erişilemedi'},
    {url:'link', reason:'Bağlı belge listesi değişti'},
    {url:'text', reason:'Kaynak içeriği değişti'},
    {url:'stale', reason:'Son başarılı kontrol 48 saatten eski veya tarihi bilinmiyor'},
    {url:'invalid', reason:'Son başarılı kontrol 48 saatten eski veya tarihi bilinmiyor'},
    {url:'missing', reason:'Henüz taranmadı'},
  ]);
});
