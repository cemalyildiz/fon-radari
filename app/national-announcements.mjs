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
  if (/^(?:www\.)?tkdk\.gov\.tr$/.test(address.hostname)) {
    if (/^\/Dokuman\/ipard-iii-\d+-basvuru-cagri-ilani(?:-[a-z0-9]+)*-\d+$/i.test(path)) return true;
    if (!/^\/Duyuru\/[a-z0-9-]+-\d+$/i.test(path) ||
        !/\bipard iii\b/.test(hints) ||
        /\b(?:desteklenmek uzere secilen|siralama kriteri puanlari|yatirim uygulama sureleri|belgelendirme egitimi|referans fiyat)\b/.test(hints)) return false;
  }
  return true;
}
