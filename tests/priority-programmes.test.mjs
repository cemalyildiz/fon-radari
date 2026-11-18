import test from 'node:test';
import assert from 'node:assert/strict';
import {documents,parseRound,noticeStages,classify} from '../scripts/priority-programmes.mjs';
import {applyRounds} from '../app/programme-watch.ts';
import {matchesAudience} from '../app/audience-utils.ts';
const url='https://tubitak.gov.tr/sites/default/files/2026-11/test.pdf';
const anchor='<a href="'+url+'">1507 Programı 2026-2 Çağrı Duyurusu</a>';
const [doc]=documents(anchor,'1507');
const body='1507 KOBİ 2026-2\nÇağrı Açılış Tarihi    20.07.2026\nKuruluş Bazlı Ön Kayıt Son Tarihi1    23.11.2026 (Saat 23:59)\nÇağrı Kapanış Tarihi2    25.11.2026 (Saat 23:59)\nSadece KOBİ niteliğinde olan sermaye şirketleri başvuru yapabilmektedir.';
const now=Date.parse('2026-11-18T12:00:00Z');
const round={...parseRound(doc,body),checkedAt:new Date(now).toISOString()};
test('official period + PDF schedule + explicit applicant clause create a searchable private round',()=>{
  const [c]=applyRounds([], [round],now);
  assert.equal(c.status,'open');assert.equal(c.deadline,'2026-11-25T23:59:00+03:00');assert.equal(matchesAudience(c,'Özel sektör'),true);
  assert.deepEqual(documents(anchor.replace('tubitak.gov.tr','example.com'),'1507'),[]);
  assert.equal(parseRound(doc,body.replace('2026-2','2026-1')),undefined);
  assert.equal(parseRound(doc,body.replace('25.11','31.11')),undefined);
  assert.equal(parseRound(doc,body.replace('23.11','03.11')).preDeadline.slice(0,10),'2026-11-03');
});
test('pre-registration does not move final deadline; confirmed extension reopens same ID; conflict blocks it',()=>{
  const [c]=applyRounds([], [round],now);
  assert.equal(applyRounds([c],[{...round,preDeadline:'2026-11-24'}],now)[0].deadline,c.deadline);
  const archived={...c,status:'archived',deadline:'2026-11-12'};
  const updated=applyRounds([archived], [round],now);
  assert.equal(updated.length,1);assert.equal(updated[0].id,c.id);assert.equal(updated[0].status,'open');
  assert.equal(applyRounds([archived],[{...round,conflict:true}],now)[0].status,'unknown');
  assert.equal(applyRounds([], [round],Date.parse('2026-11-19'))[0].status,'open');
});
test('extension tables use programme column and attached period, not stray dates or another stage',()=>{
  const table='<table><tr><td></td><td>1507 Programı</td><td>1707 Programı</td></tr><tr><td>Kuruluş Bazlı Ön Kayıt Başvurusu Son Tarihi</td><td>23 Kasım 2026</td><td>25 Kasım 2026</td></tr></table>';
  assert.deepEqual(noticeStages(table+anchor+' 2 Aralık 2026 dilekçe'),[{key:'1507-2026-2',field:'preDeadline',value:'2026-11-23'}]);
  assert.deepEqual(noticeStages(table+anchor+anchor.replace('2026-2','2026-1')),[]);
  assert.equal(classify('Çağrının Başvuru Süresi Uzatıldı'),'Değişiklik');
  assert.equal(classify('Çağrı Sıkça Sorulan Sorular'),'Çağrı değil');
});
