import test from 'node:test';
import assert from 'node:assert/strict';
import { parseDefiLlamaQuotes } from '../snapshots/prices.mjs';

test('DefiLlama quote parser maps all supported tokens with fresh timestamps', () => {
  const now = 1_700_000_000_000;
  const quotes = parseDefiLlamaQuotes({
    coins: {
      'coingecko:walrus-2': { price: 0.25, timestamp: now / 1000 },
      'coingecko:deep': { price: 0.125, timestamp: now / 1000 },
      'coingecko:suins-token': { price: 0.01, timestamp: now / 1000 },
    },
  }, now);
  assert.equal(quotes.WAL.source, 'DefiLlama');
  assert.equal(quotes.WAL.price, '25000000');
  assert.equal(quotes.DEEP.price, '12500000');
  assert.equal(quotes.NS.price, '1000000');
});
