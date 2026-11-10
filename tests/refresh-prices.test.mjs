import test from 'node:test';
import assert from 'node:assert/strict';
import { refreshPrices } from '../snapshots/refresh-prices.mjs';

test('one-minute cache avoids upstream calls and writes', async () => {
  const previous = { fetchedAt: new Date(100000).toISOString(), quotes: {} };
  const store = { get: async () => previous, putQuote: () => assert.fail('unexpected write') };
  assert.equal(await refreshPrices(store, () => assert.fail('unexpected fetch'), 120000), previous);
});

test('failed sources retain last quotes without changing their timestamps', async () => {
  const quote = { price: '123', scale: 8, updatedAt: 1 };
  let saved;
  const store = { get: async () => ({ fetchedAt: new Date(0).toISOString(), quotes: { NS: quote } }), putQuote: async (value) => { saved = value; } };
  await refreshPrices(store, async () => { throw new Error('offline'); }, 100000);
  assert.deepEqual(saved.quotes.NS, quote);
  assert.equal(saved.fetchedAt, new Date(100000).toISOString());
});
