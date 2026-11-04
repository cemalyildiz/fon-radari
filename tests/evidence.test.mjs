import test from 'node:test';
import assert from 'node:assert/strict';
import { evidenceState, contentHash } from '../scripts/monitor-evidence.mjs';
test('changed evidence remains pending across repeated hourly reads',()=>{
  const baseline = evidenceState(undefined,'original','2026-11-04');
  const changed = evidenceState(baseline,'revision','2026-11-05');
  assert.equal(changed.changed,true);
  assert.equal(evidenceState(changed,'revision','2026-11-06').changed,true);
  assert.equal(evidenceState(changed,'original','2026-11-06').changed,false);
});
test('an access denied page cannot replace a valid evidence fingerprint',()=>{
  assert.throws(()=>contentHash(new TextEncoder().encode('<main>Erişim engellendi</main>'),'text/html'));
});
