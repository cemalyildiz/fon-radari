import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { calls } from "../app/calls-data.ts";
import { realStatus, nextDeadline, matchesSector, matchesSearch, stale, mergeCalls, validateFeed, unreviewedAnnouncements } from "../app/call-utils.ts";
import { parseResult, reconcile, collect, migrateLegacy } from "../scripts/update-live-calls.mjs";
import { verificationCoverage } from "../app/verification-utils.ts";
import { isNationalFundingCandidate } from "../app/national-announcements.mjs";
const now = Date.parse("2026-09-09T12:00:00Z");
const base = { ...calls.find(c => c.id === "tubitak-1501-2026-2") };
test("national discovery keeps application and extension notices, not result, training or menu pages", () => {
  const url = "https://tubitak.gov.tr/tr/duyuru/ilan";
  assert.equal(isNationalFundingCandidate("TEYDEB 1507 başvuru sonuçları açıklandı", url), false);
  assert.equal(isNationalFundingCandidate("TÜBİTAK BİGG Çağrısı’nın Sonuçları Belli Oldu", url), false);
  assert.equal(isNationalFundingCandidate("Kış Okulu 2026 başvuruları başladı", url), false);
  assert.equal(isNationalFundingCandidate("Sel ve taşkından etkilenen KOBİ’lere faiz/kâr payı desteği", "https://kosgeb.gov.tr/site/tr/genel/detay/9505/destek"), true);
  assert.equal(isNationalFundingCandidate("Kapasite Geliştirme Destek Programı", "https://www.kosgeb.gov.tr/site/tr/genel/destekdetay/9200/program"), false);
  assert.equal(isNationalFundingCandidate("1832 Sanayide Yeşil Dönüşüm Çağrısı Süre Uzatımı", url), true);
  assert.equal(isNationalFundingCandidate("Proje çağrısı", "not a URL"), false);
});
test("an unconfirmed opening does not make a call open or prevent archive after verified closing", async () => {
  const data = JSON.parse(await readFile(new URL("../public/verified-conditions.json", import.meta.url), "utf8"));
  const flood = {...calls.find(c => c.id === "kosgeb-sel-taskin-2026"), ...data["kosgeb-sel-taskin-2026"]};
  assert.equal(realStatus(flood, Date.parse("2026-11-06T12:00:00+03:00")), "unknown");
  assert.equal(realStatus(flood, Date.parse("2026-12-31T18:00:00+03:00")), "unknown");
  assert.equal(realStatus(flood, Date.parse("2027-01-01T00:00:00+03:00")), "archived");
  assert.equal(realStatus({...flood, verificationIssues:[{field:"deadline",message:"Tarih çelişkisi"}]}, Date.parse("2027-01-01T00:00:00+03:00")), "unknown");
});
test("verification coverage separates documented fields, missing values and conflicting sources", async () => {
  const data = JSON.parse(await readFile(new URL("../public/verified-conditions.json", import.meta.url), "utf8"));
  const reviewed = { ...base, ...data[base.id] };
  assert.equal(verificationCoverage(reviewed).complete, true);
  assert.deepEqual(verificationCoverage({ ...reviewed, deadline: "" }).pendingFields, ["deadline"]);
  assert.equal(verificationCoverage({ ...reviewed, evidenceUrl: undefined }).complete, false);
  const phd = calls.find(c => c.id === "tubitak-2244-sanayi-doktora-2026");
  const check = verificationCoverage({ ...phd, ...data[phd.id] });
  assert.deepEqual(check.pendingFields, ["application"]);
  assert.equal(check.complete, false);
});
test("EIC 2027 publishes the confirmed WIDERA schedule without assigning a contradictory Transition deadline", async () => {
  const data = JSON.parse(await readFile(new URL("../public/verified-conditions.json", import.meta.url), "utf8"));
  const id = "eic-transition-open-2027";
  const transition = {...calls.find(c => c.id === id), ...data[id]};
  const checked = verificationCoverage(transition);
  assert.deepEqual(checked.pendingFields, ["openDate", "deadline"]);
  assert.equal(nextDeadline(transition,now),undefined);
  const pre = calls.find(c => c.id === "eic-pre-accelerator-2027");
  assert.equal(realStatus(pre,Date.parse("2026-11-05T12:00:00+03:00")),"upcoming");
  assert.equal(realStatus(pre,Date.parse("2027-11-18T19:00:00+03:00")),"archived");
  assert.equal(verificationCoverage({...pre,...data[pre.id]}).complete,true);
});
test("a reviewed national announcement replaces its metadata card without hiding other calls", async () => {
  const feed = JSON.parse(await readFile(new URL("../public/national-calls.json", import.meta.url), "utf8"));
  const reviewed = calls.find(c => c.id === "tubitak-2244-sanayi-doktora-2026");
  const duplicate = { ...reviewed, id: "national-auto-2244", verification: "metadata" };
  const other = { ...duplicate, id: "different-announcement", title: "Farklı TÜBİTAK proje çağrısı açıldı", sourceUrl: "https://tubitak.gov.tr/tr/duyuru/another-announcement" };
  assert.deepEqual(unreviewedAnnouncements([reviewed], [duplicate, other]), [other]);
  assert.ok(unreviewedAnnouncements(calls, feed.calls).every(c => !calls.some(r => r.sourceUrl === c.sourceUrl)));
  assert.equal(realStatus(reviewed, Date.parse("2026-11-05T12:00:00+03:00")), "open");
  assert.equal(realStatus(reviewed, Date.parse("2026-12-22T17:30:00+03:00")), "archived");
});
test("TTO opportunities distinguish open support, closed rounds and service provision", () => {
  const date = Date.parse("2026-09-10T15:00:00Z");
  assert.equal(realStatus(calls.find(c => c.id === "tubitak-1613-ttp"), date), "open");
  assert.equal(realStatus(calls.find(c => c.id === "tubitak-1601-2026-gcip"), date), "archived");
  assert.equal(realStatus(calls.find(c => c.id === "tubitak-1513-tto"), date), "unknown");
  assert.equal(realStatus(calls.find(c => c.id === "msca-staff-exchanges-2027-tto"), date), "unknown");
  assert.equal(calls.find(c => c.id === "tubitak-1831-continuous").ttoRole, "Hizmet sağlayıcı");
  for (const call of calls.filter(c => c.ttoRole)) assert.ok(call.ttoEligibility);
});
const portal = "https://ec.europa.eu/info/funding-tenders/opportunities/portal/screen/opportunities/";
const item = (id, date = "2026-11-04T16:00:00Z") => ({summary:`Topic ${id}`,metadata:{type:["1"],identifier:[id],url:[portal+"topic-details/"+id],deadlineDate:[date],startDate:["2026-01-01T00:00:00Z"],status:["31094502"]}});
test("date-only cut-offs remain uncertain on the local closing day, then advance", () => {
  const call = calls.find(c => c.id === "eit-urban-mobility-startups-2026-2028");
  const dayBefore = Date.parse("2027-04-11T20:59:00Z");
  const closingDay = Date.parse("2027-04-11T21:00:00Z");
  const followingDay = Date.parse("2027-04-12T21:00:00Z");
  assert.equal(nextDeadline(call,dayBefore),"2027-04-12");
  assert.equal(mergeCalls([call],{},dayBefore)[0].calendarDateOnly,true);
  assert.equal(realStatus(call,closingDay),"unknown");
  assert.equal(nextDeadline(call,followingDay),"2027-08-30");
  assert.equal(realStatus(call,followingDay),"open");
  assert.equal(realStatus(call,Date.parse("2028-03-13T19:00:00+03:00")),"archived");
});
test("EIC advances to next deadline instead of archiving entire programme", () => {
  const eic = calls.find(c => c.id === "eic-accelerator-2026");
  assert.equal(nextDeadline(eic,now), "2026-11-04T17:00:00+01:00");
  assert.equal(realStatus(eic,now), "open");
  assert.equal(realStatus(eic,Date.parse("2026-11-04T16:00:00Z")), "archived");
});
test("unknown dates and programme directories are never assumed open", () => {
  assert.equal(realStatus({...base,deadline:undefined}, now), "unknown");
  assert.equal(realStatus({...base,deadline:"bad"}, now), "unknown");
  assert.equal(realStatus({...base,recordType:"program",applicationType:"continuous"}, now), "unknown");
  assert.equal(realStatus({...base,status:"archived",applicationType:"continuous"}, now), "archived");
});
test("sector filter includes general calls only when enabled", () => {
  assert.equal(matchesSector(base,"Otomotiv ve Mobilite"),true);
  assert.equal(matchesSector(base,"Otomotiv ve Mobilite",false),false);
  assert.equal(matchesSector({...base,sectors:undefined},"Otomotiv ve Mobilite"),false);
});
test("search folds Turkish accents and supports multiple words in any order", () => {
  assert.equal(matchesSearch(base,"yesil tubitak"),true);
  assert.equal(matchesSearch(base,"TÜBİTAK yeşil"),true);
  assert.equal(matchesSearch(base,"yesil olmayan-kelime"),false);
});
test("freshness rejects missing, invalid, future and old timestamps", () => {
  for (const date of [undefined,"bad","2030-01-01","2026-07-26"]) assert.equal(stale(date,now),true);
  assert.equal(stale("2026-09-09T10:00:00Z",now),false);
});
test("new API calls actually join displayed collection without duplicate identifiers", () => {
  const record = parseResult(item("HORIZON-TEST"),new Date(now).toISOString());
  const combined = mergeCalls(calls,{checkedAt:new Date(now).toISOString(),calls:[record,record]},now);
  assert.equal(combined.length,calls.length+1);
  const live = combined.find(c=>c.code==="HORIZON-TEST");
  assert.equal(live.verification,"metadata");
  assert.equal(live.verifiedAt,"");
  assert.equal(live.status,"open");
});
test("feed validation rejects unsafe URLs and bad dates", () => {
  const record = parseResult(item("TEST"),new Date(now).toISOString());
  assert.equal(validateFeed({calls:[record]}),true);
  assert.equal(validateFeed({calls:[{...record,url:"javascript:alert(1)"}]}),false);
  assert.equal(validateFeed({calls:[{...record,deadlines:["bad"]}]}),false);
});
test("parser retains all deadlines and normalizes source offsets", () => {
  const sample = item("TEST");
  sample.metadata.deadlineDate = ["bad","2026-09-02T17:00:00.000+0200","2026-11-04T17:00:00.000+0100"];
  const result = parseResult(sample,new Date(now).toISOString());
  assert.equal(result.deadlines.length,2);
  assert.equal(result.deadline,"2026-11-04T16:00:00.000Z");
  assert.equal(parseResult(item("../unsafe"),new Date(now).toISOString()),null);
});
test("cascade and EuropeAid use their own official identities, titles and links", () => {
  const date = new Date(now).toISOString();
  const topic = parseResult(item("PARENT"), date);
  const cascadeInput = {...item("PARENT").metadata,type:["8"],language:["en"],REFERENCE:["12902COMPETITIVE_CALLen"],title:["Parent project"],callTitle:["Separate open call"],url:[portal+"competitive-calls-cs/46813062"],deadlineDate:["2027-02-03T23:59:00Z"],closingDate:["2026-05-19T00:00:00Z"]};
  const cascade = parseResult({metadata:cascadeInput},date);
  assert.equal(cascade.identifier,"cascade-46813062-12902");
  assert.equal(cascade.title,"Separate open call");
  assert.equal(cascade.sourceReference,"PARENT");
  assert.equal(cascade.status,"unknown");
  const otherCascade = parseResult({metadata:{...cascadeInput,REFERENCE:["12903COMPETITIVE_CALLen"],callTitle:["Another competition"]}},date);
  const translated = parseResult({metadata:{...cascadeInput,REFERENCE:["12902COMPETITIVE_CALLfr"],language:["fr"],callTitle:["Autre titre"],deadlineDate:["2027-02-04T23:59:00Z"]}},date);
  const grouped = reconcile([], [cascade,otherCascade,translated],date);
  assert.equal(grouped.length,2);
  assert.equal(grouped[0].title,"Separate open call");
  assert.deepEqual(grouped[0].deadlines,cascade.deadlines);
  const external = parseResult({metadata:{...item("EuropeAid/187670/DD/ACT/Multi").metadata,type:["2"],title:["Cross-border programme"],url:["https://webgate.ec.europa.eu/prospect/external/publishedcalls.htm?callId=187670"]}},date);
  assert.equal(external.identifier,"europeaid-187670");
  assert.equal(validateFeed({calls:[topic,cascade,external]}),true);
  assert.equal(validateFeed({calls:[{...cascade,url:portal+"topic-details/PARENT"}]}),false);
  assert.equal(parseResult({metadata:{...item("PARENT").metadata,type:["8"],callTitle:["Fake"],url:["https://ec.europa.eu.attacker.invalid/competitive-calls-cs/46813062"]}},date),null);
  const migrated = migrateLegacy({calls:[{...topic,sourceKind:undefined},{...topic,identifier:"UNRESOLVED",sourceKind:undefined}]},[topic,cascade,external],[],date);
  assert.equal(migrated.calls.length,3);
  assert.deepEqual(migrated.unresolvedLegacy.map(c=>c.identifier),["UNRESOLVED"]);
  const cards = mergeCalls([],{calls:migrated.calls},now);
  assert.equal(cards.find(c=>c.code===cascade.identifier).status,"unknown");
  assert.equal(cards.find(c=>c.code===topic.identifier).deadline,topic.deadline);
  const reviewed = {...cards.find(c=>c.code===cascade.identifier), id:"reviewed-cascade", code:"Reviewed", reviewedPortalIdentifier:cascade.identifier};
  const withReview = mergeCalls([reviewed],{calls:[cascade,otherCascade]},now);
  assert.equal(withReview.length,2);
  assert.equal(withReview.some(c=>c.id==="reviewed-cascade"),true);
  assert.equal(withReview.some(c=>c.code===otherCascade.identifier),true);
});
test("legacy entries are preserved for audit but never shown with a guessed topic URL", () => {
  const date = new Date(now).toISOString();
  const archived = parseResult(item("OLD","2026-08-01T00:00:00Z"),date);
  const legacy = {...archived,sourceKind:undefined};
  assert.deepEqual(mergeCalls([],{calls:[legacy]},now),[]);
  const migrated = migrateLegacy({calls:[legacy]},[],[archived],date);
  assert.equal(migrated.unresolvedLegacy.length,0);
  assert.equal(mergeCalls([],{calls:migrated.calls},now)[0].status,"archived");
});
test("archive retained; missing future record marked unknown; obsolete deadline replaced", () => {
  const date = new Date(now).toISOString();
  const old = parseResult(item("OLD","2026-07-01T00:00:00Z"),date);
  const missing = parseResult(item("MISSING"),date);
  const changed = parseResult(item("CHANGED","2026-12-01T00:00:00Z"),date);
  const current = parseResult(item("CHANGED"),date);
  const result = reconcile([old,missing,changed],[current],date);
  assert.equal(result.length,3);
  assert.equal(result.find(c=>c.identifier==="MISSING").status,"unknown");
  assert.equal(result.find(c=>c.identifier==="CHANGED").deadlines.length,1);
  assert.equal(result.find(c=>c.identifier==="CHANGED").deadline,current.deadline);
});
test("pagination fetches all pages, not first twelve records", async () => {
  const visited=[];
  const fake = async url => {
    const p=Number(url.searchParams.get("pageNumber")); visited.push(p);
    return {ok:true,json:async()=>({totalResults:205,results:Array.from({length:p===3?5:100},(_,i)=>item(`TEST-${p}-${i}`))})};
  };
  const result=await collect(fake,new Date(now).toISOString());
  assert.equal(result.calls.length,205);
  assert.deepEqual(visited.sort(),[1,2,3]);
});
test("partial pagination is rejected rather than publishing a success timestamp", async () => {
  const fake=async url=>({ok:true,json:async()=>({totalResults:101,results:url.searchParams.get("pageNumber")==="1"?Array.from({length:100},(_,i)=>item(`TEST-${i}`)):[]})});
  await assert.rejects(()=>collect(fake,new Date(now).toISOString()),/Incomplete/);
});
test("old archive rows are recovered only by an exact official identifier", async () => {
  const fake = async (_url, { body }) => {
    const q = JSON.parse(await body.get("query").text());
    const lookup = q.bool.must.find(x => x.terms?.identifier);
    const results = lookup ? [item("ARCHIVE","2026-02-01T00:00:00Z"), item("UNRELATED","2026-02-01T00:00:00Z")] : [item("CURRENT")];
    return {ok:true,json:async()=>({totalResults:results.length,results})};
  };
  const result=await collect(fake,new Date(now).toISOString(),{legacyIdentifiers:["ARCHIVE"]});
  assert.deepEqual(result.calls.map(c=>c.identifier),["CURRENT"]);
  assert.deepEqual(result.historical.map(c=>c.identifier),["ARCHIVE"]);
});
test("Horizon budget uses exact topic and separates annual amount from expected contribution", () => {
  const sample = item("HORIZON-TEST");
  const row = {action:"HORIZON-TEST - HORIZON-IA",budgetYearMap:{"2027":"30000000"},minContribution:10000000,maxContribution:10000000,expectedGrants:3};
  const source = "https://ec.europa.eu/info/funding-tenders/opportunities/docs/2021-2027/horizon/example.pdf";
  Object.assign(sample.metadata, {
    frameworkProgramme:["43108390"],
    topicConditions:[`<a href="${source}">Work programme</a><a href="https://example.com/file.pdf">Other</a>`],
    budgetOverview:[JSON.stringify({budgetTopicActionMap:{a:[row],b:[{...row,action:"HORIZON-TEST-OTHER - HORIZON-IA",budgetYearMap:{"2027":"999"}}]}})]
  });
  const stamp = new Date(now).toISOString();
  const record = parseResult(sample,stamp);
  assert.deepEqual(record.sourceBudget,[{action:"HORIZON-IA",yearly:{"2027":30000000},min:10000000,max:10000000,grants:3}]);
  assert.deepEqual(record.conditionDocuments,[source]);
  assert.equal(validateFeed({calls:[record]}),true);
  assert.equal(validateFeed({calls:[{...record,conditionDocuments:[null]}]}),false);
  const [card] = mergeCalls([],{calls:[record]},now);
  assert.match(card.fundingAmount,/30\.000\.000/);
  assert.match(card.fundingAmount,/Proje başına beklenen AB katkısı: .*10\.000\.000/);
  assert.equal(card.verification,"metadata");
  assert.equal(card.applicantGroups,undefined);
  const different = {...record,sourceBudget:[{...record.sourceBudget[0],yearly:{"2027":20000000}}]};
  const [conflict] = reconcile([], [record,different,record],stamp);
  assert.equal(conflict.sourceBudgetConflict,true);
  assert.equal(conflict.sourceBudget,undefined);
  sample.metadata.budgetOverview=[JSON.stringify({budgetTopicActionMap:{shared:[row,{...row,action:"HORIZON-TEST-OTHER - HORIZON-IA"}]}})];
  assert.deepEqual(parseResult(sample,stamp).sourceBudget[0].yearly,{});
});
test("midnight placeholder dates do not assert an exact closing hour or same-day archive", () => {
  const record = parseResult(item("TEST","2026-11-04T00:00:00Z"),new Date(now).toISOString());
  const onDay = mergeCalls([],{calls:[record]},Date.parse("2026-11-04T12:00:00+03:00"))[0];
  assert.equal(onDay.status,"unknown");
  assert.equal(onDay.calendarDateOnly,true);
  assert.equal(mergeCalls([],{calls:[record]},Date.parse("2026-11-05T00:00:00+03:00"))[0].status,"archived");
});
test("curated identifiers unique and official links use HTTPS", () => {
  assert.equal(new Set(calls.map(c=>c.id)).size,calls.length);
  for(const call of calls) {
    assert.ok(call.sourceUrl.startsWith("https://"));
    if(call.deadline) assert.ok(Number.isFinite(Date.parse(call.deadline)),call.id);
    assert.ok(call.sectors?.length,call.id);
  }
});
test("scheduled update and deployment are in the same workflow", async () => {
  const workflow=await readFile(new URL("../.github/workflows/pages.yml",import.meta.url),"utf8");
  assert.match(workflow,/schedule:/); assert.match(workflow,/npm run update:calls/); assert.match(workflow,/actions\/deploy-pages/);
  const old=await readFile(new URL("../.github/workflows/update-calls.yml",import.meta.url),"utf8");
  assert.doesNotMatch(old,/schedule:/);
});
