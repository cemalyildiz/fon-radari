import type { ApplicantGroup, FundingCall } from "./calls-data.ts";

export const audienceOptions = ["Tümü", "Özel sektör", "Akademisyen", "Üniversite / Araştırma", "Kamu kurum / kuruluşu", "TTO / Arayüz kuruluşu", "STK", "Henüz sınıflandırılmamış"] as const;
export type AudienceFilter = typeof audienceOptions[number];

// Sınıflandırma, resmî başvuru koşullarının incelemesinde açıkça kaydedilir.
// Başlık, kurum adı, tema veya firma ölçeğinden uygunluk türetilmez.
export function matchesAudience(call: Pick<FundingCall, "applicantGroups">, audience: AudienceFilter) {
  if (audience === "Tümü") return true;
  if (audience === "Henüz sınıflandırılmamış") return !call.applicantGroups?.length;
  return Boolean(call.applicantGroups?.includes(audience as ApplicantGroup));
}

export function privateSectorPriority(a: FundingCall, b: FundingCall) {
  return Number(matchesAudience(b, "Özel sektör")) - Number(matchesAudience(a, "Özel sektör"));
}
