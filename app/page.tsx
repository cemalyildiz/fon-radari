import CallsExplorer from "./CallsExplorer";
import { calls } from "./calls-data";
import { readFile } from "node:fs/promises";
import type { FundingCall } from "./calls-data";
import { mergeMentoring1831Intake, mergeNationalCalendars, unreviewedAnnouncements } from "./call-utils";
import { evidenceAlerts } from "./verification-utils";
import { revisionIndexFor } from "./programme-revision.mjs";
import { hit30CallsUrl, observedHit30Status } from "./hit30-status.mjs";
import { applyRounds } from "./programme-watch";

const snapshotTime = Date.now();

export default async function Home() {
  const conditions = await readFile('public/conditions.json', 'utf8').then(JSON.parse).catch(() => ({}));
  const verified = await readFile('public/verified-conditions.json', 'utf8').then(JSON.parse).catch(() => ({}));
  const evidence = await readFile('public/evidence-status.json', 'utf8').then(JSON.parse).catch(() => ({}));
  const updatedCalls = calls.map(c => {
    const review = verified[c.id];
    const evidenceUrl = review?.evidenceUrl ?? c.evidenceUrl;
    const additionalEvidence = [...new Set<string>([
      ...(review?.additionalEvidence ?? c.additionalEvidence ?? []),
      ...[revisionIndexFor(evidenceUrl)].filter((url): url is string => Boolean(url)),
    ])];
    const urls = [evidenceUrl, ...additionalEvidence].filter(Boolean);
    const alerts = evidenceAlerts(urls, evidence, snapshotTime);
    const status = c.hit30Topic ? observedHit30Status(evidence[hit30CallsUrl], c.hit30Topic, snapshotTime) : c.status;
    const hit30CheckedAt = c.hit30Topic ? evidence[hit30CallsUrl]?.checkedAt : undefined;
    return {...c, ...review, status, hit30CheckedAt, additionalEvidence, evidenceAlerts: alerts, evidencePending: alerts.length > 0, sourceConditions: conditions[c.id]};
  });
  const feed = await readFile('public/national-calls.json', 'utf8').then(JSON.parse).catch(() => ({ calls: [] }));
  const calendars = mergeNationalCalendars(updatedCalls, feed.calendars ?? [], snapshotTime);
  const watch = JSON.parse(await readFile('public/call-watch.json','utf8'));
  const displayed = applyRounds([...calendars.updated, ...calendars.discovered],Object.values(watch.rounds),snapshotTime).map(call => mergeMentoring1831Intake(call, feed.mentoring1831, snapshotTime));
  const reviewedUrls = displayed.flatMap(c => c.calendarSourceUrl ? [c, {sourceUrl:c.calendarSourceUrl}] : [c]);
  const separated = new Set(watch.queue.filter((q:{kind:string;linked:string[]})=>q.kind==='Çağrı değil'||q.kind==='Değişiklik'||q.linked.length).map((q:{url:string})=>q.url));
  const discovered = unreviewedAnnouncements(reviewedUrls, (feed.calls as FundingCall[]).filter(c=>!separated.has(c.sourceUrl)));
  return <CallsExplorer calls={[...displayed, ...discovered]} sources={watch.sources} watch={watch} />;
}
