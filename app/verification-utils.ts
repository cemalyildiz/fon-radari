import type { FundingCall } from "./calls-data.ts";

const core = ["applicants", "companyScale", "fundingAmount", "fundingType", "supportRate", "duration", "application"] as const;
const labels = {
  applicants: "Başvuru sahibi", companyScale: "Kuruluş ölçeği", fundingAmount: "Destek tutarı",
  fundingType: "Destek şekli", supportRate: "Destek oranı", duration: "Süre",
  application: "Başvuru yöntemi", openDate: "Açılış tarihi", deadline: "Kapanış tarihi",
  recordType: "Program / çağrı ayrımı", applicationType: "Başvuru takvimi türü",
} as const;
type CoreField = keyof typeof labels;
export function verificationFieldLabel(field: CoreField) {
  return labels[field];
}
export function verificationCoverage(call: FundingCall) {
  const calendar: CoreField[] = call.recordType === "program" ? ["recordType"]
    : call.applicationType === "continuous" ? ["applicationType"] : ["openDate", "deadline"];
  const issues = call.verificationIssues ?? [];
  const verifiedFields = (call.verifiedFields ?? []).filter(field => !issues.some(issue => issue.field === field));
  const isVerified = (field: CoreField) => {
    if (!call.evidenceUrl || !verifiedFields.includes(field)) return false;
    const value = call[field];
    if (field === "openDate" || field === "deadline") return typeof value === "string" && Number.isFinite(Date.parse(value));
    return Array.isArray(value) ? value.some(item => item.trim().length > 0) : typeof value === "string" && value.trim().length > 0;
  };
  const required = [...core, ...calendar];
  const verifiedCore = required.filter(isVerified);
  const pendingFields = required.filter(field => !isVerified(field));
  return { verifiedFields, verifiedCore, pendingFields, issues, complete: pendingFields.length === 0 && issues.length === 0 };
}
