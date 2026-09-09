import type { FundingCall, CallStatus } from "./calls-data.ts";

export type LiveCall = {
  identifier: string; title: string; url: string; deadline?: string;
  deadlines?: string[]; startDate?: string | null; actionType?: string;
  sourceCheckedAt?: string; status?: string;
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
  return (feed.checkedAt == null || validDate(feed.checkedAt)) && Array.isArray(feed.calls) && feed.calls.every(c =>
    c && typeof c.identifier === "string" && /^[a-z0-9_.-]+$/i.test(c.identifier) && typeof c.title === "string" &&
    typeof c.url === "string" && c.url.startsWith("https://ec.europa.eu/info/funding-tenders/opportunities/portal/screen/opportunities/topic-details/") &&
    (!c.deadline || validDate(c.deadline)) && (!c.deadlines || (Array.isArray(c.deadlines) && c.deadlines.every(validDate)))
  );
}
export function mergeCalls(curated: FundingCall[], feed: LiveFeed, now: number): FundingCall[] {
  const codes = new Set(curated.map(c => c.code.toLowerCase()));
  const seen = new Set<string>();
  const imported: FundingCall[] = (feed.calls ?? []).filter(c => {
    const key = c.identifier.toLowerCase();
    if (codes.has(key) || seen.has(key)) return false;
    seen.add(key); return true;
  }).map(c => ({
    id: `eu-${c.identifier}`, scope: "international", code: c.identifier, title: c.title,
    institution: "Avrupa Komisyonu — Funding & Tenders", institutionShort: "AB / Funding & Tenders",
    status: c.status === "31094503" ? "archived" : c.status && !["31094501", "31094502"].includes(c.status) ? "unknown" : "open",
    openDate: c.startDate ?? "", deadline: c.deadline, deadlines: c.deadlines,
    applicants: "Türkiye’den katılım, kuruluş ölçeği ve ortaklık şartları resmî çağrı metninden kontrol edilmelidir.",
    companyScale: ["Uygunluk kontrolü gerekli"], themes: ["Sınıflandırılmamış"], sectors: ["Sınıflandırılmamış"],
    fundingAmount: "Resmî çağrı metninden kontrol edilmeli", fundingType: c.actionType ?? "Çağrı koşullarına bağlı",
    summary: "Resmî AB kaynağından otomatik aktarılan çağrı. Tarih ve başlık bilgisi alınmıştır; sanayi kuruluşları için uygunluk ve destek koşulları ayrıca doğrulanmalıdır.",
    objectives: [], eligibleCosts: [], application: "Funding & Tenders Portal üzerinden çağrı koşullarını inceleyin.",
    sourceUrl: c.url, sourceLabel: "Resmî AB çağrı sayfası", verifiedAt: "", verification: "metadata",
    sourceCheckedAt: c.sourceCheckedAt ?? feed.checkedAt ?? undefined, tags: [c.identifier],
  }));
  return [...curated, ...imported].map(c => ({ ...c, deadline: nextDeadline(c, now), status: realStatus(c, now) }));
}
