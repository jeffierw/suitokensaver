import test from 'node:test';
import assert from 'node:assert/strict';
import { readAllPages, validateNameRecord } from '../server/chain.mjs';

test('all object pages are read before reporting a complete scan', async () => {
  const result = await readAllPages(async (cursor) => cursor
    ? { nodes: [{ address: 'two' }], pageInfo: { hasNextPage: false } }
    : { nodes: [{ address: 'one' }], pageInfo: { hasNextPage: true, endCursor: 'next' } });
  assert.deepEqual(result.map((object) => object.address), ['one', 'two']);
});
test('failed later pages fail the query, never return incomplete success', async () => {
  await assert.rejects(readAllPages(async (cursor) => {
    if (cursor) throw new Error('upstream failure');
    return { nodes: [{ address: 'one' }], pageInfo: { hasNextPage: true, endCursor: 'next' } };
  }), /upstream/);
});
test('repeated cursors stop rather than loop forever', async () => {
  await assert.rejects(readAllPages(async () => ({
    nodes: [], pageInfo: { hasNextPage: true, endCursor: 'repeat' },
  })), /pagination/i);
});
test('name must have a target and an unexpired record', () => {
  const target = `0x${'ab'.repeat(32)}`;
  const record = { target: { address: target }, contents: { json: { expiration_timestamp_ms: '5000' } } };
  assert.equal(validateNameRecord(record, 4000), target);
  assert.throws(() => validateNameRecord(record, 6000), /expired/i);
  assert.throws(() => validateNameRecord({ ...record, target: null }, 4000), /target/i);
  assert.throws(() => validateNameRecord(null, 4000), /not found/i);
});
