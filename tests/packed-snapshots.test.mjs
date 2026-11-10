import test from 'node:test';
import assert from 'node:assert/strict';
import { validateManifest, evidenceBucket, artifactKeyValid, EVIDENCE_BUCKETS } from '../snapshots/packed.mjs';
import { SCOPES } from '../snapshots/schema.mjs';

export const manifest = (id = 'test-run') => ({
  version: 2, id, complete: true, unresolved: 0, holders: 1, allocations: 1,
  checkpoint: { sequenceNumber: 123, timestamp: new Date().toISOString() },
  completedAt: new Date().toISOString(),
  scopes: Object.fromEntries(SCOPES.map((scope) => [scope, {
    amount: scope.startsWith('NS/') && scope.endsWith('/claimable') ? '9007199254740993' : '0',
    holders: scope.startsWith('NS/') && scope.endsWith('/claimable') ? 1 : 0,
    allocations: scope.startsWith('NS/') && scope.endsWith('/claimable') ? 1 : 0,
    recoveryAllocations: 0, pages: 1,
  }])),
});

test('packed plan bounds artifacts and accepts only declared scopes and shards', () => {
  const data = manifest();
  assert.equal(validateManifest(data), SCOPES.length + EVIDENCE_BUCKETS);
  assert.equal(artifactKeyValid('page/NS/all/claimable/1', data), true);
  assert.equal(artifactKeyValid('page/NS/all/claimable/2', data), false);
  assert.equal(artifactKeyValid('evidence/1024', data), false);
  assert.equal(artifactKeyValid('../secrets', data), false);
  assert.equal(evidenceBucket(`0x${'f'.repeat(64)}`), 1023);
  assert.throws(() => validateManifest({ ...data, complete: false }));
  assert.throws(() => validateManifest({ ...data, scopes: {} }));
  data.scopes['NS/all/claimable'].pages = 12000;
  assert.throws(() => validateManifest(data));
});
