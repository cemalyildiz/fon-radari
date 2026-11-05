import type { FundingCall, CallStatus } from "./calls-data.ts";
import { destinationIdentifier, officialDestination } from "./live-source.mjs";
import { officialConditionDocument, validBudgetRow } from "./live-evidence.mjs";

type PortalBudget = { action: string; yearly: Record<string, number>; min: number | null; max: number | null; grants: number | null };

export type LiveCall = {
  identifier: string; title: string; url: string; deadline?: string;
  deadlines?: string[]; startDate?: string | null; actionType?: string;
  sourceCheckedAt?: string; status?: string;
  sourceKind?: "topic" | "external" | "cascade";
  sourceRecordId?: string; sourceLanguage?: string;
  sourceReference?: string; sourceWarning?: string;
  sourceBudget?: PortalBudget[]; sourceBudgetConflict?: boolean;
  conditionDocuments?: string[];
};
export type LiveFeed = { checkedAt?: string | null; attemptedAt?: string; calls?: LiveCall[]; degraded?: boolean };
export function validDate(value?: string | null): boolean {
  return Boolean(value && Number.isFinite(Date.parse(value)));
}
export function nextDeadline(call: Pick<FundingCall, "deadline" | "deadlines">, now: number) {
  const dates = (call.deadlines?.length ? call.deadlines : [call.deadline]).filter((d): d is string => validDate(d));
  dates.sort((a, b) => Date.parse(a) - Date.parse(b));
  return dates.find(d => Date.parse(d) > now) ?? dates.at(-1);
}
export function realStatus(call: FundingCall, now: number): CallStatus {
  if (call.recordType === "program" || call.status === "unknown") return "unknown";
  if (call.status === "archived") return "archived";
  const deadline = nextDeadline(call, now);
  if (deadline && Date.parse(deadline) <= now) return "archived";
  if (validDate(call.openDate) && Date.parse(call.openDate) > now) return "upcoming";
  if (call.applicationType === "continuous") return "open";
  if (!deadline || !validDate(call.openDate)) return "unknown";
  return "open";
}
export function normalizeText(value: string) {
  return value.toLocaleLowerCase("tr-TR").replace(/ı/g, "i").normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}
export function matchesSearch(call: FundingCall, query: string) {
  const text = normalizeText([call.title, call.code, call.institution, call.institutionShort, call.summary, call.applicants, ...call.tags, ...(call.themes ?? []), ...(call.sectors ?? [])].join(" "));
  return normalizeText(query).trim().split(/\s+/).every(word => text.includes(word));
}
export function matchesSector(call: FundingCall, sector: string, includeGeneral = true) {
  return sector === "Tümü" || Boolean(call.sectors?.includes(sector)) || (includeGeneral && Boolean(call.sectors?.includes("Sektörler Arası")));
}
export function stale(value: string | null | undefined, now: number, hours = 48) {
  return !validDate(value) || Date.parse(value!) > now || now - Date.parse(value!) > hours * 3_600_000;
}
export function fundingCategory(call: FundingCall) {
  const text = normalizeText(call.fundingType);
  if (/oz sermaye|karma|yatirim/.test(text)) return "Yatırım / karma finansman";
  if (/kredi|faiz|kar payi/.test(text)) return "Kredi / finansman desteği";
  if (/geri odemeli/.test(text)) return "Geri ödemeli destek";
  if (/hibe|geri odemesiz/.test(text)) return "Hibe";
  if (/tesvik|vergi/.test(text)) return "Teşvik";
  return "Diğer / koşullara bağlı";
}
export function validateFeed(value: unknown): value is LiveFeed {
  if (!value || typeof value !== "object") return false;
  const feed = value as LiveFeed;
  return (feed.checkedAt == null || validDate(feed.checkedAt)) && Array.isArray(feed.calls) && feed.calls.every(c => {
    if (!c || typeof c.identifier !== "string" || !/^[a-z0-9_.-]+$/i.test(c.identifier) || typeof c.title !== "string") return false;
    const destination = officialDestination(c.url);
    return Boolean(destination
      && (c.sourceKind ?? "topic") === destination.kind
      && (destination.kind !== "cascade" || (typeof c.sourceRecordId === "string" && /^\d+$/.test(c.sourceRecordId)))
      && destinationIdentifier(destination, c.sourceRecordId).toLowerCase() === c.identifier.toLowerCase()
      && (!c.sourceWarning || typeof c.sourceWarning === "string")
      && (!c.sourceReference || typeof c.sourceReference === "string")
      && (c.sourceBudget === undefined || (c.sourceKind === "topic" && /^HORIZON-/i.test(c.identifier) && Array.isArray(c.sourceBudget) && c.sourceBudget.length <= 8 && c.sourceBudget.every(validBudgetRow)))
      && (c.sourceBudgetConflict === undefined || (c.sourceBudgetConflict === true && !c.sourceBudget?.length))
      && (c.conditionDocuments === undefined || (Array.isArray(c.conditionDocuments) && c.conditionDocuments.length <= 10 && c.conditionDocuments.every(u => typeof u === "string" && officialConditionDocument(u) === u)))
      && (!c.deadline || validDate(c.deadline))
      && (!c.deadlines || (Array.isArray(c.deadlines) && c.deadlines.every(validDate))));
  });
}
export function unreviewedAnnouncements(reviewed: Pick<FundingCall, "sourceUrl">[], discovered: FundingCall[]) {
  const reviewedUrls = new Set(reviewed.map(call => call.sourceUrl));
  return discovered.filter(call => !reviewedUrls.has(call.sourceUrl));
}
export type NationalCalendarRow = {
  key: string; title: string; sourceUrl: string; openDate: string; deadline: string; checkedAt: string;
  notCurrent?: boolean;
};
export function mergeNationalCalendars(calls: FundingCall[], observations: NationalCalendarRow[], now: number) {
  const byKey = new Map(observations.filter(row =>
    /^\d{4}-20\d\d-\d{1,2}$/.test(row.key) &&
    /^https:\/\/tubitak\.gov\.tr\/tr\/destekler\/destek\/sanayi\/ulusal-destek-programlari\/cagri-[a-z0-9-]+$/.test(row.sourceUrl) &&
    validDate(row.openDate) && validDate(row.deadline) && Date.parse(row.deadline) > Date.parse(row.openDate) &&
    validDate(row.checkedAt)
  ).map(row => [row.key, row]));
  const used = new Set<string>();
  const updated = calls.map(call => {
    const row = byKey.get(call.id.replace(/^tubitak-/, ""));
    if (!row || call.scope !== "national" || row.sourceUrl !== call.calendarSourceUrl) return call;
    used.add(row.key);
    const {sourceUrl, openDate, deadline, checkedAt} = row;
    const conflict = Date.parse(openDate) !== Date.parse(call.openDate) || Date.parse(deadline) !== Date.parse(call.deadline ?? "");
    return { ...call, calendarObservation: {sourceUrl, openDate, deadline, checkedAt, conflict, notCurrent:row.notCurrent}, ...(conflict && {status: "unknown" as const}) };
  });
  const discovered: FundingCall[] = [...byKey.values()].filter(row => !used.has(row.key)).map(row => ({
    id: `tubitak-calendar-${row.key}`, title: row.title, code: row.key, scope: "national",
    institution: "Türkiye Bilimsel ve Teknolojik Araştırma Kurumu", institutionShort: "TÜBİTAK",
    status: Date.parse(row.deadline) <= now ? "archived" : row.notCurrent || stale(row.checkedAt, now) ? "unknown" : "open",
    openDate: row.openDate, deadline: row.deadline, sourceCheckedAt: row.checkedAt, verifiedAt: "",
    sourceUrl: row.sourceUrl, sourceLabel: "TÜBİTAK resmî çağrı sayfası",
    applicants: "Başvuru sahipleri henüz doğrulanmadı", companyScale: [],
    fundingAmount: "Henüz doğrulanmadı", fundingType: "Henüz doğrulanmadı",
    summary: "Başvuru aralığı TÜBİTAK açık çağrı listesiyle çağrı sayfasında karşılaştırıldı. Başvuru koşulları henüz doğrulanmadı.",
    verification: "metadata", objectives: [], eligibleCosts: [], tags: ["Resmî takvim"],
    application: "Başvurmadan önce resmî çağrı metnindeki koşulları inceleyin.",
    calendarObservation: {sourceUrl:row.sourceUrl, openDate:row.openDate, deadline:row.deadline, checkedAt:row.checkedAt, notCurrent:row.notCurrent},
  }));
  return { updated, discovered };
}
function importedStatus(call: LiveCall, now: number): CallStatus {
  const deadline = nextDeadline(call, now);
  if (["31094503", "310945031", "99999998"].includes(call.status ?? "") || (deadline && portalDeadlinePassed(deadline, now))) return "archived";
  if (deadline && utcMidnight(deadline) && deadline.slice(0, 10) === turkeyDay.format(now)) return "unknown";
  if (call.status === "31094501" && validDate(call.startDate) && Date.parse(call.startDate!) > now) return "upcoming";
  return call.status === "31094502" ? "open" : "unknown";
}
const eur = new Intl.NumberFormat("tr-TR", { style: "currency", currency: "EUR", maximumFractionDigits: 2, minimumFractionDigits: 0 });
function portalBudgetText(rows: PortalBudget[]) {
  return rows.map(({ action, yearly, min, max, grants }) => {
    const yearlyText = Object.entries(yearly).map(([year, value]) => `${year}: ${eur.format(value)}`).join(", ");
    const expected = min !== null && max !== null ? min === max ? eur.format(min) : `${eur.format(min)}–${eur.format(max)}`
      : min !== null ? `alt değer ${eur.format(min)}` : max !== null ? `üst değer ${eur.format(max)}` : "";
    return [rows.length > 1 ? action : "", yearlyText && `Gösterge konu bütçesi: ${yearlyText}`, expected && `Proje başına beklenen AB katkısı: ${expected}`, grants && `Gösterge proje sayısı: ${grants}`].filter(Boolean).join(" · ");
  }).join(" / ");
}
export const utcMidnight = (value?: string | null) => typeof value === "string" && value.endsWith("T00:00:00.000Z");
const turkeyDay = new Intl.DateTimeFormat("sv-SE", { year: "numeric", month: "2-digit", day: "2-digit", timeZone: "Europe/Istanbul" });
export function portalDeadlinePassed(date: string, now: number) {
  return utcMidnight(date) ? date.slice(0, 10) < turkeyDay.format(now) : Date.parse(date) <= now;
}
export function mergeCalls(curated: FundingCall[], feed: LiveFeed, now: number): FundingCall[] {
  const codes = new Set(curated.map(c => c.code.toLowerCase()));
  const seen = new Set<string>();
  const imported: FundingCall[] = (feed.calls ?? []).filter(c => {
    const key = c.identifier.toLowerCase();
    if (!c.sourceKind || (c.sourceKind === "topic" && codes.has(key)) || seen.has(key)) return false;
    seen.add(key); return true;
  }).map(c => ({
    id: `eu-${c.identifier}`, scope: "international", code: c.identifier, title: c.title,
    institution: c.sourceKind === "cascade" ? "Alt çağrıyı yayımlayan proje — AB Funding & Tenders" : "Avrupa Komisyonu — Funding & Tenders",
    institutionShort: c.sourceKind === "cascade" ? "AB / Proje alt çağrısı" : c.sourceKind === "external" ? "AB / Dış eylem" : "AB / Funding & Tenders",
    status: importedStatus(c, now),
    openDate: c.startDate ?? "", deadline: c.deadline, deadlines: c.deadlines,
    openingDateOnly: utcMidnight(c.startDate), calendarDateOnly: utcMidnight(nextDeadline(c, now)),
    applicants: "Türkiye’den katılım, kuruluş ölçeği ve ortaklık şartları resmî çağrı metninden kontrol edilmelidir.",
    companyScale: ["Uygunluk kontrolü gerekli"], themes: ["Sınıflandırılmamış"], sectors: ["Sınıflandırılmamış"],
    fundingAmount: c.sourceBudget?.length && !c.sourceBudgetConflict ? portalBudgetText(c.sourceBudget) : "Resmî çağrı metninden kontrol edilmeli",
    portalBudget: Boolean(c.sourceBudget?.length && !c.sourceBudgetConflict), portalDocuments: c.conditionDocuments,
    fundingType: c.actionType ?? "Çağrı koşullarına bağlı",
    summary: c.sourceKind === "cascade"
      ? "AB destekli bir projenin ayrı alt çağrısıdır. Ana projenin hibe çağrısı değildir; uygunluk ve destek koşulları bu alt çağrının belgesinden kontrol edilmelidir."
      : "Resmî AB kaynağından otomatik aktarılan çağrı. Tarih ve başlık bilgisi alınmıştır; sanayi kuruluşları için uygunluk ve destek koşulları ayrıca doğrulanmalıdır.",
    objectives: [], eligibleCosts: [],
    application: c.sourceKind === "cascade"
      ? "AB portalındaki alt çağrı listesinden bu başlığı ve çağrı referansını bulun; düzenleyicinin başvuru belgelerini kontrol edin."
      : "Resmî çağrı bağlantısından başvuru koşullarını inceleyin.",
    sourceUrl: c.url, sourceLabel: c.sourceKind === "cascade" ? "AB portalındaki alt çağrı listesi" : "Resmî AB çağrı sayfası", verifiedAt: "", verification: "metadata",
    sourceCheckedAt: c.sourceCheckedAt ?? feed.checkedAt ?? undefined, tags: [c.identifier, ...(c.sourceReference ? [c.sourceReference] : [])],
    notice: [c.sourceWarning, c.sourceBudgetConflict ? "Aynı eylem için farklı bütçe değerleri geldiğinden otomatik tutar gösterilmiyor." : "", utcMidnight(nextDeadline(c, now)) ? "AB API’sindeki gece yarısı zaman damgası kesin kapanış saati olarak gösterilmez. Güncel saati çağrı belgesinden kontrol edin." : ""].filter(Boolean).join(" ") || undefined,
  }));
  return [...curated, ...imported].map(c => ({ ...c, deadline: nextDeadline(c, now), status: realStatus(c, now) }));
}
