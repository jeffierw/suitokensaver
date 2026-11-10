import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { Miniflare } from 'miniflare';
import { D1SnapshotStore } from '../../cloudflare/d1-store.mjs';
import { SCOPES } from '../../snapshots/schema.mjs';
import { EVIDENCE_BUCKETS, digest } from '../../snapshots/packed.mjs';

function manifest(id) {
  return { version: 2, id, complete: true, unresolved: 0, holders: 0, allocations: 0,
    checkpoint: { sequenceNumber: id === 'first' ? 123 : 124, timestamp: new Date().toISOString() },
    completedAt: new Date().toISOString(),
    scopes: Object.fromEntries(SCOPES.map((scope) => [scope, { amount: '0', holders: 0, allocations: 0, recoveryAllocations: 0, pages: 1 }])) };
}

test('D1 staging validates completeness, retries, daily budget, pinned reads and atomic publication', async () => {
  const mf = new Miniflare({ modules: true, script: 'export default {fetch(){return new Response("ok")}}', d1Databases: ['DB'] });
  try {
    const db = await mf.getD1Database('DB');
    const [tables, trigger] = (await readFile('cloudflare/migrations/0002_packed_snapshots.sql', 'utf8')).split('CREATE TRIGGER');
    for (const sql of tables.split(';').filter((sql) => sql.trim())) await db.exec(sql.replace(/\n/g, ' '));
    await db.exec(`CREATE TRIGGER${trigger}`.replace(/\n/g, ' '));
    const store = new D1SnapshotStore(db);
    const first = manifest('first');
    assert.equal(await store.latest(), null);
    await store.begin(first, 100000000);
    await assert.rejects(store.begin(manifest('second'), 100000001), /daily|active/i);
    await assert.rejects(store.publish(first.id), /incomplete/i);
    assert.equal(await store.manifest(first.id), null);
    const key = ['page', 'NS', 'all', 'claimable', '1'].join('/');
    const data = JSON.stringify({ id: first.id, scope: 'NS/all/claimable', page: 1, pages: 1, rows: [] });
    await store.upload(first.id, [{ key, data }]);
    const retry = await store.upload(first.id, [{ key, data }]);
    assert.equal(retry.rowsWritten, 0);
    await assert.rejects(store.upload(first.id, [{ key, data: '{}' }]), /conflict/i);
    await assert.rejects(store.upload(first.id, [{ key: 'evidence/99999', data: '[]' }]), /artifact/i);
    const artifacts = SCOPES.map((scope) => ({
      key: `page/${scope}/1`, data: JSON.stringify({ id: first.id, scope, page: 1, pages: 1, rows: [] }),
    }));
    for (let bucket = 0; bucket < EVIDENCE_BUCKETS; bucket++) artifacts.push({ key: `evidence/${bucket}`, data: '[]' });
    for (let index = 0; index < artifacts.length; index += 10) await store.upload(first.id, artifacts.slice(index, index + 10));
    await store.publish(first.id);
    assert.equal((await store.latest()).id, first.id);
    assert.deepEqual((await store.page(first.id, 'NS/all/claimable', 1)).rows, []);
    assert.deepEqual(await store.evidence(first.id, 'NS/all/claimable', `0x${'a'.repeat(64)}`, 1), []);
    assert.equal(await digest(data), (await db.prepare('SELECT digest FROM packed_artifacts WHERE run=? AND key=?').bind(first.id, key).first()).digest);
    await store.publish(first.id);
    await assert.rejects(store.upload(first.id, [{ key, data }]), /published/i);
    await store.begin(manifest('second'), 100000000 + 86400000);
    await assert.rejects(store.publish('second'), /incomplete/i);
    assert.equal((await store.latest()).id, first.id);
    assert.equal((await store.manifest(first.id)).id, first.id);
    assert.equal(await store.manifest('second'), null);
    await store.putQuote({ id: 'quote-test', quotes: {} });
    assert.equal((await store.quote()).id, 'quote-test');
  } finally { await mf.dispose(); }
});
