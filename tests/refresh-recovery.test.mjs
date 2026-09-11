import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { supervise } from "../scripts/supervise-refresh.mjs";

const previous = { checkedAt: "2026-09-10T10:00:00Z", calls: [{ identifier: "KEEP" }], degraded: false };
async function fixture(t) {
  const dir = await mkdtemp(join(tmpdir(), "fon-recovery-"));
  t.after(() => rm(dir, { recursive: true, force: true }));
  const path = join(dir, "feed.json");
  await writeFile(path, JSON.stringify(previous));
  return { path, pause: async () => {}, now: () => "2026-09-11T10:00:00Z" };
}
test("worker crash retries and a subsequent successful feed is retained", async t => {
  const options = await fixture(t); let attempts = 0;
  const result = await supervise({ ...options, run: async () => {
    if (++attempts === 1) throw new Error("ERR_ASSERTION");
    await writeFile(options.path, JSON.stringify({ ...previous, checkedAt: options.now() }));
  } });
  assert.deepEqual(result, { degraded: false, attempts: 2 });
});
test("three crashes restore original records and timestamp with degraded flag", async t => {
  const options = await fixture(t);
  const result = await supervise({ ...options, run: async () => {
    await writeFile(options.path, "partial data");
    throw new Error("worker killed");
  } });
  assert.equal(result.degraded, true);
  assert.deepEqual(JSON.parse(await readFile(options.path, "utf8")), { ...previous, attemptedAt: options.now(), degraded: true });
});
test("a normal degraded response also retries; invalid fallback fails closed", async t => {
  const options = await fixture(t); let attempts = 0;
  await supervise({ ...options, run: async () => { attempts++; } });
  assert.equal(attempts, 3);
  await writeFile(options.path, JSON.stringify({ calls: [], checkedAt: null }));
  await assert.rejects(supervise(options), /No valid previous feed/);
});
