import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { calls } from "../app/calls-data.ts";
import { realStatus, nextDeadline, matchesSector, matchesSearch, stale, mergeCalls, validateFeed } from "../app/call-utils.ts";
import { parseResult, reconcile, collect } from "../scripts/update-live-calls.mjs";
const now = Date.parse("2026-09-09T12:00:00Z");
const base = { ...calls.find(c => c.id === "tubitak-1501-2026-2") };
test("TTO opportunities distinguish open support, closed rounds and service provision", () => {
  const date = Date.parse("2026-09-10T15:00:00Z");
  assert.equal(realStatus(calls.find(c => c.id === "tubitak-1613-ttp"), date), "open");
  assert.equal(realStatus(calls.find(c => c.id === "tubitak-1601-2026-gcip"), date), "archived");
  assert.equal(realStatus(calls.find(c => c.id === "tubitak-1513-tto"), date), "unknown");
  assert.equal(realStatus(calls.find(c => c.id === "msca-staff-exchanges-2027-tto"), date), "unknown");
  assert.equal(calls.find(c => c.id === "tubitak-1831-continuous").ttoRole, "Hizmet sağlayıcı");
  for (const call of calls.filter(c => c.ttoRole)) assert.ok(call.ttoEligibility);
});
const item = (id, date = "2026-11-04T16:00:00Z") => ({summary:`Topic ${id}`,metadata:{identifier:[id],deadlineDate:[date],startDate:["2026-01-01T00:00:00Z"],status:["31094502"]}});
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
  const result = parseResult({metadata:{identifier:["TEST"],deadlineDate:["bad","2026-09-02T17:00:00.000+0200","2026-11-04T17:00:00.000+0100"]}},new Date(now).toISOString());
  assert.equal(result.deadlines.length,2);
  assert.equal(result.deadline,"2026-11-04T16:00:00.000Z");
  assert.equal(parseResult(item("../unsafe"),new Date(now).toISOString()),null);
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
