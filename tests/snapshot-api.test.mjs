import test from 'node:test';
import assert from 'node:assert/strict';
import { serveSnapshots } from '../snapshots/api.mjs';

test('snapshot API rejects arbitrary keys and invalid paging', async () => {
  const storage = { get: async () => { throw new Error('Should not read'); } };
  for (const query of ['id=../../secret', 'id=run&token=BAD', 'id=run&token=WAL&page=-1', 'id=run&token=NS&round=wal-launch']) {
    const response = await serveSnapshots(new Request(`http://local/api/snapshots/page?${query}`), storage);
    assert.equal(response.status, 400);
  }
});
test('missing snapshot is unavailable, not a zero-valued total', async () => {
  const response = await serveSnapshots(new Request('http://local/api/snapshots/latest'), { get: async () => null });
  assert.equal(response.status, 503);
  assert.match((await response.json()).error, /snapshot/i);
});
test('page queries remain pinned to the requested snapshot', async () => {
  const keys = [];
  const response = await serveSnapshots(new Request('http://local/api/snapshots/page?id=old-run&token=WAL'), {
    get: async (key) => { keys.push(key); return key.endsWith('manifest.json') ? { id: 'old-run', scopes: { 'WAL/all/claimable': { pages: 1 } } } : { id: 'old-run', rows: [] }; },
  });
  assert.equal(response.status, 200);
  assert.deepEqual(keys, ['snapshots/old-run/manifest.json', 'snapshots/old-run/WAL/all/claimable/1.json']);
});
