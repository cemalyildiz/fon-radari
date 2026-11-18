// Only document links published by the exact official programme page are eligible.
export const hub = 'https://tubitak.gov.tr/tr/destekler/sanayi/ulusal-destek-programlari/';
export const programmes = {
  '1501':'1501-tubitak-sanayi-ar-ge-projeleri-destekleme-programi',
  '1507':'1507-tubitak-kobi-ar-ge-baslangic-destek-programi',
  '1707':'1707-siparise-dayali-ar-ge-projeleri-icin-kobi-destekleme-cagrisi',
  '1831':'1831-yesil-inovasyon-teknoloji-mentorluk-cagrisi',
  '1832':'1832-sanayide-yesil-donusum-cagrisi',
};
const norm = s => s.toLocaleLowerCase('tr').normalize('NFD').replace(/\p{M}/gu,'').replaceAll('ı','i');
const months = 'ocak subat mart nisan mayis haziran temmuz agustos eylul ekim kasim aralik'.split(' ');
export function documents(html, program) {
  const docs = new Map();
  for (const [,href,label] of html.matchAll(/<a\b[^>]*?\bhref=["']([^"']+\.pdf)["'][^>]*>([^<]+)<\/a>/gi)) {
    const title = label.trim();
    const period = norm(title).match(/\b(20\d\d)(?:\s*[-/]\s*|\s+yili\s+)([1-9])\b/);
    if (!period || !/cagri (?:dokumani|duyurusu|metni)/.test(norm(title))) continue;
    const u = new URL(href,hub);
    if (u.origin !== 'https://tubitak.gov.tr' || u.username || u.password || !u.pathname.startsWith('/sites/default/files/')) continue;
    docs.set(u.href,{key:program+'-'+period[1]+'-'+period[2],title,url:u.href});
  }
  return [...docs.values()];
}
function scheduleDate(text, label) {
  const pattern = new RegExp('^[ \\t]*'+label+'(?:\\*+| *\\d(?:, *\\d)?)?(?:[ \\t]+|[ \\t]*\\n[ \\t]+)(\\d{1,2})(?:\\.| +)([a-z]+|\\d{2})(?:\\.| +)(20\\d\\d)(?: *\\( *saat +(\\d{2})[:.](\\d{2}) *\\))? *$','gm');
  const found = [...text.matchAll(pattern)];
  if (found.length !== 1) return;
  const [,day,m,y,h,minute] = found[0];
  const month = /^\d+$/.test(m) ? +m : months.indexOf(m)+1;
  const date = y+'-'+String(month).padStart(2,'0')+'-'+day.padStart(2,'0');
  if (!Number.isFinite(Date.parse(date)) || new Date(date).toISOString().slice(0,10)!==date || (h && (+h>23 || +minute>59))) return;
  return h ? date+'T'+h+':'+minute+':00+03:00' : date;
}
export function parseRound(doc, text) {
  const [program,year,round] = doc.key.split('-');
  const body = norm(text).replace(/\r/g,'');
  if (program==='1831' || !new RegExp('\\b'+program+'\\b').test(body.slice(0,2600)) ||
    !new RegExp('\\b'+year+'(?:\\s*[-/]\\s*|\\s+yili\\s+)'+round+'\\b').test(body.slice(0,2600))) return;
  const openDate = scheduleDate(body,'basvuru alma tarihi') ?? scheduleDate(body,'cagri(?:nin)? acilis tarihi');
  const deadline = scheduleDate(body,'cagri kapanis tarihi');
  const preDeadline = scheduleDate(body,'kurulus bazli on kayit(?: basvurusu)?(?:\\*+ icin)? son tarih[i]?');
  if (!openDate || !deadline || !preDeadline || openDate.slice(0,10)>preDeadline.slice(0,10) || preDeadline.slice(0,10)>deadline.slice(0,10) || Date.parse(deadline)-Date.parse(openDate)>366*86400000) return;
  const sentences = body.replace(/\s+/g,' ');
  const sme = ['1501','1507'].includes(program) && /sadece kobi niteliginde olan sermaye sirketleri basvuru yapabil(?:ir|mektedir)/.test(sentences);
  const partners=program==='1707' && /musteri kurulus tarafindan prodis uzerinden yapilir ve tedarikci kurulus\/kuruluslar ortak kurulus olarak eklenir/.test(sentences) && /olcegine bakilmaksizin, turkiye.de yerlesik sermaye sirketlerini/.test(sentences) && /turkiye.de yerlesik kobi olceginde/.test(sentences);
  const local = program==='1832' && /cagriya turkiye.de yerlesik sermaye sirketleri basvuru yapabilir/.test(sentences);
  const both = local && /basvuru yapabilecek kuruluslar kobi.ler ve buyuk olcekli/.test(sentences);
  return {...doc,openDate,deadline,preDeadline,...((sme || local || partners) && {applicants:sme?'KOBİ niteliğinde sermaye şirketleri; dönem belgesindeki ek koşullar geçerlidir.':partners?'Türkiye’de yerleşik müşteri şirket, KOBİ tedarikçi ile birlikte başvurur. Dönem belgesindeki ek koşullar geçerlidir.':'Türkiye’de yerleşik sermaye şirketleri; dönem belgesindeki ek koşullar geçerlidir.',companyScale:sme?['KOBİ']:both||partners?['KOBİ','Büyük Ölçek']:[]})};
}
export function noticeStages(html){
  const clean=s=>norm(s.replace(/<[^>]+>/g,' ').replaceAll('&nbsp;',' ').replace(/\s+/g,' ').trim());
  const links=[...html.matchAll(/<a\b[^>]*href=["'](?:https:\/\/tubitak\.gov\.tr)?\/sites\/default\/files\/[^"']+\.pdf["'][^>]*>([^<]+)<\/a>/gi)].map(m=>clean(m[1]));
  const result=[];
  for(const [,table] of html.matchAll(/<table\b[^>]*>([\s\S]*?)<\/table>/gi)){
    const rows=[...table.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)].map(m=>[...m[1].matchAll(/<t[hd]\b[^>]*>([\s\S]*?)<\/t[hd]>/gi)].map(c=>clean(c[1])));
    const header=rows.shift()??[];
    for(let i=1;i<header.length;i++){
      const p=header[i].match(/^(1501|1507|1707|1832) programi$/)?.[1];
      if(!p || header.indexOf(header[i])!==header.lastIndexOf(header[i]))continue;
      const keys=new Set(links.flatMap(l=>{const m=l.match(new RegExp('^'+p+'\\b.*?\\b(20\\d\\d)[-/]([1-9])\\b.*?cagri'));return m?[p+'-'+m[1]+'-'+m[2]]:[]}));
      if(keys.size!==1)continue;
      for(const [label,field] of [['kurulus bazli on kayit basvurusu son tarihi','preDeadline'],['cagri kapanis tarihi','deadline']]){
        const matched=rows.filter(r=>r[0]===label && r.length===header.length);
        const value=matched.length===1 && scheduleDate('tarih '+matched[0][i].replace(/\*+$/,''),'tarih');
        if(value)result.push({key:[...keys][0],field,value});
      }
    }
  }
  return result;
}
export function classify(title) {
  const t=norm(title);
  if (/sure.{0,24}uzati|degisiklik|guncellen/.test(t)) return 'Değişiklik';
  if (/sik(?:ca)? sorulan|bilgilendirme|desteklemek uzere secilen|hak kazanan|sozlesme imzalayacak|uygulama suresi/.test(t)) return 'Çağrı değil';
  if (/cagri.{0,35}(?:acildi|basladi|yay[iy]nlandi|yayimlandi)|basvuru.{0,35}basladi|cagri ilani|programi ilani|teklif cagrisi ilan/.test(t)) return 'Yeni çağrı adayı';
  return 'İnceleme gerekli';
}
