/** @param {string} value */
function normalized(value) {
  return value
    .toLocaleLowerCase("tr-TR")
    .normalize("NFKD")
    .replace(/\p{M}|[\u200b-\u200d\ufeff]/gu, "")
    .replace(/ı/g, "i")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

const etkbMirrors = new Map([["1109", "30601"], ["1114", "30609"], ["1125", "30623"]]);
// Reviewed KOSGEB news and programme pages describe the same specific 2026 rounds.
const kosgebReviewedAliases = new Map([["9476", "9206"], ["9206", "9206"], ["9471", "9224"], ["9473", "9224"], ["9224", "9224"]]);
export function nationalAnnouncementKey(url) {
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "https:" || parsed.username || parsed.password || parsed.port) return url;
    if (/^(?:www\.|webyonetim\.)?kosgeb\.gov\.tr$/.test(parsed.hostname) && !parsed.search && !parsed.hash) {
      const [, kosgebId] = parsed.pathname.match(/^\/site\/tr\/genel\/(?:detay|destekdetay)\/(\d+)(?:\/[^/]+)?\/?$/i) ?? [];
      if (kosgebReviewedAliases.has(kosgebId)) return `https://kosgeb.gov.tr/site/tr/genel/destekdetay/${kosgebReviewedAliases.get(kosgebId)}`;
    }
    const id = parsed.searchParams.get("id") ?? "";
    if (!/^\d+$/.test(id) || parsed.searchParams.size !== 1) return url;
    if (parsed.hostname === "enerjiverimliligi.enerji.gov.tr" &&
        parsed.pathname.toLowerCase() === "/home/duyurudetay" && etkbMirrors.has(id)) {
      return `https://duyuru.enerji.gov.tr/duyuru-detay?id=${etkbMirrors.get(id)}`;
    }
    if (/^(?:duyuru\.|www\.)?enerji\.gov\.tr$/.test(parsed.hostname) && parsed.pathname === "/duyuru-detay") {
      return `https://duyuru.enerji.gov.tr/duyuru-detay?id=${id}`;
    }
  } catch { /* Keep unrecognised links unchanged. */ }
  return url;
}

// This is only a discovery gate. An accepted link still proves no eligibility or open status.
/** @param {string} title @param {string} url */
export function isNationalFundingCandidate(title, url) {
  const name = normalized(title);
  let address;
  try { address = new URL(url); } catch { return false; }
  if (address.protocol !== "https:" || address.username || address.password) return false;
  const path = address.pathname;
  const slug = normalized(path.split("/").at(-1) ?? "");
  const hints = `${name} ${slug}`;
  if (!/\b(?:cagri\w*|basvur\w*|deste[kg]\w*|hibe\w*|finansman\w*)\b/.test(hints)) return false;

  const newApplication = /\b(?:basvuru\w*|cagri\w*)\s+(?:acildi|basladi|alimi basladi|basvuruya acildi)\b/.test(name);
  const results = /\b(?:sonuclandi|sonuc\w*\s+(?:aciklandi|belli oldu|ilan edildi|yayimlandi|yayinlandi)|desteklenmeye hak kazananlar)\b/;
  if (!newApplication && results.test(hints)) return false;

  // Focus on unmistakable non-funding announcements, not grants that fund training as an expense.
  if (/\b(?:kis okulu|yaz okulu|ihracat surecleri ve devlet destekleri egitim programi|bilgilendirme (?:toplantisi|webinari)|kangal yarismasi)\b/.test(hints)) return false;
  if (/^(?:www\.)?kosgeb\.gov\.tr$/.test(address.hostname) && !/^\/site\/tr\/genel\/(?:detay|duyurudetay)\/\d+\//i.test(path)) return false;
  if (/^(?:www\.)?dogaka\.gov\.tr$/.test(address.hostname) &&
      (!/^\/(?:tr\/)?duyuru\/[^/]+\/\d+\/?$/i.test(path) || /\b(?:personel|staj|ihale)\b/.test(name))) return false;
  if (/^(?:www\.)?karacadag\.gov\.tr$/.test(address.hostname) &&
      (!/^\/duyuru\/\d+\/[a-z0-9-]+\/?$/i.test(path) ||
        /\b(?:sonuclar\w*|ihale|personel|staj|proje hazirlama egitim\w*)\b/.test(name))) return false;
  const enver = address.hostname === "enerjiverimliligi.enerji.gov.tr";
  if ((enver || /^(?:duyuru\.|www\.)?enerji\.gov\.tr$/.test(address.hostname)) &&
      (!(enver ? /^\/Home\/DuyuruDetay$/i : /^\/duyuru-detay$/i).test(path) ||
        !/^\d+$/.test(address.searchParams.get("id") ?? "") ||
        !/\b(?:vap|eka|eps|verimlilik artirici proje|enerji ve karbon azaltim|enerji performans sozlesme\w*|enerji verimliligi destek bedelleri)\b/.test(name) ||
        /\b(?:sinav\w*|sonuclar\w*|egitim kaydi)\b/.test(name))) return false;
  if (/^(?:www\.)?tkdk\.gov\.tr$/.test(address.hostname)) {
    if (/^\/Dokuman\/ipard-iii-\d+-basvuru-cagri-ilani(?:-[a-z0-9]+)*-\d+$/i.test(path)) return true;
    if (!/^\/Duyuru\/[a-z0-9-]+-\d+$/i.test(path) ||
        !/\bipard iii\b/.test(hints) ||
        /\b(?:desteklenmek uzere secilen|siralama kriteri puanlari|yatirim uygulama sureleri|belgelendirme egitimi|referans fiyat)\b/.test(hints)) return false;
  }
  return true;
}

export function enverAnnouncementLinks(data) {
  if (!Array.isArray(data)) throw new Error("Enerji Bakanlığı duyuru listesi okunamadı");
  return data.flatMap(row => /^\d+$/.test(String(row?.id)) && typeof row?.duyuruBaslik === "string"
    ? [[null, `/Home/DuyuruDetay?id=${row.id}`, row.duyuruBaslik]] : []);
}
