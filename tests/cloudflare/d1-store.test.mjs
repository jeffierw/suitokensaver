import test from 'node:test';
import assert from 'node:assert/strict';
import { D1SnapshotStore } from '../../cloudflare/d1-store.mjs';

function database() {
  const rows = new Map();
  return {
    async exec() {},
    prepare(sql) {
      let values = [];
      return {
        bind(...args) { values = args; return this; },
        async run() { rows.set(`${sql}:${JSON.stringify(values)}`, values); return { success: true }; },
        async first() { return null; },
        async all() { return { results: [] }; },
      };
    },
    async batch(statements) { for (const statement of statements) await statement.run(); },
    rows,
  };
}

test('D1 publication writes exact pages before making a run latest', async () => {
  const db = database();
  const store = new D1SnapshotStore(db);
  await store.ensure();
  await store.putRecords('run-1', [{ objectId: '0x1', address: '0xaaa', symbol: 'NS', campaignId: 'ns-launch', status: 'claimable', amount: '9007199254740993' }]);
  await store.putPage('run-1', 'NS/all/claimable', 1, { id: 'run-1', rows: [{ address: '0xaaa', amount: '9007199254740993' }] });
  await store.publish({ id: 'run-1', scopes: { 'NS/all/claimable': { pages: 1 } } });
  assert.ok([...db.rows.values()].some((args) => JSON.stringify(args).includes('9007199254740993')));
  assert.ok([...db.rows.values()].some((args) => JSON.stringify(args).includes('latest')));
});
