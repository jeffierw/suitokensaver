import test from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { SnapshotStore } from '../snapshots/store.mjs';
import { quoteValue, parseQuotes } from '../snapshots/prices.mjs';

function database() {
  const db = new DatabaseSync(':memory:');
  return {
    exec(sql, ...args) { return db.prepare(sql).all(...args); },
    transaction(fn) {
      db.exec('BEGIN');
      try { const result = fn(); db.exec('COMMIT'); return result; }
      catch (error) { db.exec('ROLLBACK'); throw error; }
    },
  };
}
function record(index, overrides = {}) {
  return { objectId: `0x${String(index).padStart(64, '0')}`, address: `0x${'a'.repeat(64)}`, symbol: 'DEEP', decimals: 6,
    campaignId: 'deep-s1', status: 'claimable', amount: '9007199254740993', ...overrides };
}
function store() {
  const store = new SnapshotStore(database(), 'run-test');
  store.addJob({ id: 'first', kind: 'collect', sourceId: 'deep-s1', cursor: null, page: 0 });
  return store;
}
test('page retry and repeated objects cannot double-count exact integer totals', () => {
  const db = store();
  const page = { records: [record(1), record(1), record(2)], unresolved: [], hasNextPage: false };
  assert.equal(db.commitPage('first', page), true);
  assert.equal(db.commitPage('first', page), false);
  const rows = db.rows('DEEP/all/claimable', 1);
  assert.equal(rows[0].amount, '18014398509481986');
  assert.equal(rows[0].allocations, 2);
  assert.equal(db.summary().holders, 1);
});
test('global holders are a union, and locked allocations remain separate', () => {
  const db = store();
  db.commitPage('first', { records: [record(1), record(2, { symbol: 'NS', campaignId: 'ns-launch' }),
    record(3, { status: 'locked' })], unresolved: [], hasNextPage: false });
  const summary = db.summary();
  assert.equal(summary.holders, 1);
  assert.equal(summary.allocations, 2);
  assert.equal(db.rows('DEEP/all/locked', 1).length, 1);
});
test('25-row pages sort numerically with address tie breaks', () => {
  const db = store();
  const records = Array.from({ length: 30 }, (_, index) => record(index + 1, {
    address: `0x${String(index + 1).padStart(64, '0')}`, amount: String(index + 1),
  }));
  db.commitPage('first', { records, unresolved: [], hasNextPage: false });
  assert.equal(db.rows('DEEP/all/claimable', 1).length, 25);
  assert.equal(db.rows('DEEP/all/claimable', 2).length, 5);
  assert.equal(db.rows('DEEP/all/claimable', 1)[0].amount, '30');
});
test('cursor loops and conflicting duplicate records roll back the whole page', () => {
  const db = store();
  assert.throws(() => db.commitPage('first', {
    records: [record(1), record(1, { amount: '42' })], unresolved: [], hasNextPage: false,
  }), /conflict/i);
  assert.equal(db.rows('DEEP/all/claimable', 1).length, 0);
  assert.throws(() => db.commitPage('first', { records: [], unresolved: [], hasNextPage: true, endCursor: null }), /cursor/i);
});
test('unresolved evidence marks summary incomplete instead of adding zero value', () => {
  const db = store();
  db.commitPage('first', { records: [record(1)], unresolved: [{ sourceId: 'deep-s1', objectId: 'bad', reason: 'missing' }], hasNextPage: false });
  assert.equal(db.summary().complete, false);
  assert.equal(db.summary().unresolved, 1);
});
test('prices reject stale or missing quotes and compute cents exactly', () => {
  const now = 1794220000000;
  const quotes = parseQuotes({ deep: { usd: 0.123456, last_updated_at: now / 1000 } }, now);
  assert.equal(quoteValue('1000000', 6, quotes.DEEP, now), '12');
  assert.equal(quoteValue('1000000', 6, quotes.NS, now), null);
  assert.equal(quoteValue('1000000', 6, quotes.DEEP, now + 1200001), null);
  assert.equal(parseQuotes({ deep: { usd: -1, last_updated_at: now / 1000 } }, now).DEEP, null);
});

test('due job selection is bounded and completed jobs are excluded', () => {
  const db = store();
  for (let index = 0; index < 200; index++) db.addJob({ id: `job-${index}`, kind: 'publish', page: index + 1, scope: 'DEEP/all/claimable' });
  assert.equal(db.dueJobs(Date.now(), 4).length, 4);
  assert.equal(db.hasPending('collect'), true);
  db.markDone('first');
  assert.equal(db.hasPending('collect'), false);
  assert.equal(db.hasPending('publish'), true);
  const now = Date.now();
  const sent = db.dueJobs(now, 1)[0];
  db.db.exec('UPDATE jobs SET sent=? WHERE run=? AND id=?', now, db.runId, sent.id);
  assert.equal(db.dueJobs(now, 200).some((job) => job.id === sent.id), false);
  assert.equal(db.dueJobs(now + 60001, 200).some((job) => job.id === sent.id), true);
  assert.equal(db.dueJobs(now, 200).some((job) => job.id === 'first'), false);
});

test('retention preserves latest and active runs but removes obsolete evidence markers', () => {
  const db = store();
  db.commitPage('first', { records: [record(1)], unresolved: [], hasNextPage: false });
  db.setMeta('published:run-test', { id: 'run-test', completedAt: '2020-01-01T00:00:00Z' });
  db.setMeta('latest', { id: 'run-test' });
  const active = new SnapshotStore(db.db, 'active-run');
  active.addJob({ id: 'active-page', kind: 'collect' });
  db.prune(Date.now(), ['active-run']);
  assert.equal(db.rows('DEEP/all/claimable', 1).length, 1);
  db.setMeta('latest', { id: 'new-run' });
  db.prune(Date.now(), ['active-run']);
  assert.equal(db.rows('DEEP/all/claimable', 1).length, 0);
  assert.equal(db.meta('published:run-test'), null);
  assert.ok(db.meta('garbage:run-test'));
  assert.equal(active.hasPending('collect'), true);
  db.prune(Date.now() + 86400001, ['active-run']);
  assert.equal(db.meta('garbage:run-test'), null);
});
