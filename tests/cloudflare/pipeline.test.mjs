import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { Miniflare } from 'miniflare';
import { SCOPES } from '../../snapshots/schema.mjs';

test('HTTP importer authenticates, hides staging, and publishes complete snapshots without DO', async () => {
  const secret = crypto.randomUUID();
  const mf = new Miniflare({
    modules: true, scriptPath: '.wrangler/build/worker.js', compatibilityDate: '2026-05-03',
    d1Databases: { SNAPSHOTS_DB: 'snapshot-test' },
    bindings: { SNAPSHOT_IMPORT_TOKEN: secret },
  });
  try {
    const db = await mf.getD1Database('SNAPSHOTS_DB');
    const [tables, trigger] = (await readFile('cloudflare/migrations/0002_packed_snapshots.sql', 'utf8')).split('CREATE TRIGGER');
    for (const sql of tables.split(';').filter((sql) => sql.trim())) await db.exec(sql.replace(/\n/g, ' '));
    await db.exec(`CREATE TRIGGER${trigger}`.replace(/\n/g, ' '));
    const call = (route, body, auth = true) => mf.dispatchFetch(`http://local/internal/snapshot/${route}`, {
      method: 'POST', headers: auth ? { Authorization: `Bearer ${secret}` } : {},
      body: JSON.stringify(body),
    });
    const manifest = { version: 2, id: 'http-test', complete: true, unresolved: 0, holders: 0, allocations: 0,
      checkpoint: { sequenceNumber: 123, timestamp: new Date().toISOString() }, completedAt: new Date().toISOString(),
      scopes: Object.fromEntries(SCOPES.map((scope) => [scope, { amount: '0', holders: 0, allocations: 0, pages: 1 }])) };
    assert.equal((await call('begin', { manifest }, false)).status, 404);
    assert.equal((await call('begin', { manifest })).status, 200);
    assert.equal((await call('publish', { id: manifest.id })).status, 409);
    assert.equal((await mf.dispatchFetch('http://local/api/snapshots/latest')).status, 503);
    const artifacts = SCOPES.map((scope) => ({ key: `page/${scope}/1`,
      data: JSON.stringify({ id: manifest.id, scope, page: 1, pages: 1, rows: [] }) }));
    for (let bucket = 0; bucket < 1024; bucket++) artifacts.push({ key: `evidence/${bucket}`, data: '[]' });
    for (let index = 0; index < artifacts.length; index += 10) {
      assert.equal((await call('artifacts', { id: manifest.id, artifacts: artifacts.slice(index, index + 10) })).status, 200);
    }
    assert.equal((await call('publish', { id: manifest.id })).status, 200);
    assert.equal((await (await mf.dispatchFetch('http://local/api/snapshots/latest')).json()).id, manifest.id);
    assert.equal((await mf.dispatchFetch(`http://local/api/snapshots/page?id=${manifest.id}&token=NS`)).status, 200);
    assert.equal((await call('cleanup', {})).status, 200);
  } finally { await mf.dispose(); }
});
