import CallsExplorer from "./CallsExplorer";
import { calls } from "./calls-data";
import { readFile } from "node:fs/promises";
import type { FundingCall } from "./calls-data";
import { mergeNationalCalendars, unreviewedAnnouncements } from "./call-utils";
import { evidenceAlerts } from "./verification-utils";

const snapshotTime = Date.now();

export default async function Home() {
  const conditions = await readFile('public/conditions.json', 'utf8').then(JSON.parse).catch(() => ({}));
  const verified = await readFile('public/verified-conditions.json', 'utf8').then(JSON.parse).catch(() => ({}));
  const evidence = await readFile('public/evidence-status.json', 'utf8').then(JSON.parse).catch(() => ({}));
  const updatedCalls = calls.map(c => {
    const review = verified[c.id];
    const urls = review ? [review.evidenceUrl, ...(review.additionalEvidence ?? [])].filter(Boolean) : [];
    const alerts = evidenceAlerts(urls, evidence, snapshotTime);
    return {...c, ...review, evidenceAlerts: alerts, evidencePending: alerts.length > 0, sourceConditions: conditions[c.id]};
  });
  const feed = await readFile('public/national-calls.json', 'utf8').then(JSON.parse).catch(() => ({ calls: [] }));
  const calendars = mergeNationalCalendars(updatedCalls, feed.calendars ?? [], snapshotTime);
  const displayed = [...calendars.updated, ...calendars.discovered];
  const reviewedUrls = displayed.flatMap(c => c.calendarSourceUrl ? [c, {sourceUrl:c.calendarSourceUrl}] : [c]);
  const discovered = unreviewedAnnouncements(reviewedUrls, feed.calls as FundingCall[]);
  return <><aside style={{padding:'12px 24px',background:'#eef4f0'}}>Ulusal kaynak taraması: {Object.entries(feed.sources ?? {}).map(([name, value]) => { const s = value as {ok:boolean;checkedAt?:string}; return `${name}: ${s.ok ? 'kontrol edildi' : 'erişim sorunu'}${s.checkedAt ? ` (${new Date(s.checkedAt).toLocaleString('tr-TR', {timeZone:'Europe/Istanbul'})})` : ''}`; }).join(' · ')}. Otomatik keşfedilen duyurular için “Tüm durumlar” filtresini kullanın.</aside><CallsExplorer calls={[...displayed, ...discovered]} /></>;
}
