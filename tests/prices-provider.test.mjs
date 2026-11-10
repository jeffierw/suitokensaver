import test from 'node:test';
import assert from 'node:assert/strict';
import { CETUS_TOKENS, fetchQuotes, parseCetusRoute, parseDefiLlamaQuotes, USDC_TYPE } from '../snapshots/prices.mjs';

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
test('Cetus route safely fills a missing NS quote from its exact USDC route', () => {
  const route = { data: { amount_in: 100000000, amount_out: 895500, deviation_ratio: '-0.001', paths: [{
    from: CETUS_TOKENS.NS.type, target: USDC_TYPE, provider: 'DIPCOIN',
  }] } };
  const quote = parseCetusRoute('NS', route, 1_700_000_000_000);
  assert.equal(quote.price, '895500');
  assert.deepEqual(quote.providers, ['DIPCOIN']);
  assert.equal(parseCetusRoute('NS', { data: { ...route.data, amount_in: 1 } }), null);
  assert.equal(parseCetusRoute('NS', { data: { ...route.data, paths: [{ ...route.data.paths[0], target: 'not-usdc' }] } }), null);
});
test('Cetus fallback preserves available DefiLlama quotes and covers a stale NS quote', async () => {
  const now = 1_700_000_000_000;
  const response = (body) => ({ ok: true, json: async () => body });
  const quotes = await fetchQuotes(async (url) => {
    if (url.includes('coins.llama')) return response({ coins: {
      'coingecko:walrus-2': { price: 0.25, timestamp: now / 1000 },
      'coingecko:deep': { price: 0.125, timestamp: now / 1000 },
      'coingecko:suins-token': { price: 0.01, timestamp: (now - 1300000) / 1000 },
    } });
    return response({ data: { amount_in: 100000000, amount_out: 895500, deviation_ratio: '0.001', paths: [{
      from: CETUS_TOKENS.NS.type, target: USDC_TYPE, provider: 'DIPCOIN',
    }] } });
  }, now);
  assert.equal(quotes.quotes.WAL.source, 'DefiLlama');
  assert.equal(quotes.quotes.NS.source, 'Cetus Aggregator');
});
