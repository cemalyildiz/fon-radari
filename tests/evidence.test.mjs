import test from 'node:test';
import assert from 'node:assert/strict';
import { evidenceState, contentHash, documentLinksHash } from '../scripts/monitor-evidence.mjs';
import { evidenceAlerts } from '../app/verification-utils.ts';
test('changed evidence remains pending across repeated hourly reads',()=>{
  const baseline = evidenceState(undefined,'original','2026-11-04');
  const changed = evidenceState(baseline,'revision','2026-11-05');
  assert.equal(changed.changed,true);
  assert.equal(evidenceState(changed,'revision','2026-11-06').changed,true);
  assert.equal(evidenceState(changed,'original','2026-11-06').changed,false);
});
test('an access denied page cannot replace a valid evidence fingerprint',()=>{
  assert.throws(()=>contentHash(new TextEncoder().encode('<main>Erişim engellendi</main>'),'text/html'));
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
