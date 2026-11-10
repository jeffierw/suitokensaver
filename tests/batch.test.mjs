import test from 'node:test';
import assert from 'node:assert/strict';
import { scanBatch } from '../src/batch.mjs';

test('aliases resolve once per input but scan once per address', async () => {
  const scanned = [];
  const result = await scanBatch(['bread.sui', '@bread'], {
    resolve: async () => ({ address: 'same' }),
    scan: async (address) => { scanned.push(address); return { address, groups: [] }; },
  });
  assert.deepEqual(scanned, ['same']);
  assert.deepEqual(result.results[0].inputs, ['bread.sui', '@bread']);
});

test('failed resolutions and scans remain explicit errors', async () => {
  const result = await scanBatch(['missing.sui', 'good.sui', 'fail.sui'], {
    resolve: async (input) => {
      if (input === 'missing.sui') throw new Error('Name not found');
      return { address: input };
    },
    scan: async (address) => {
      if (address === 'fail.sui') throw new Error('Provider unavailable');
      return { address, groups: [] };
    },
  });
  assert.equal(result.results.length, 1);
  assert.equal(result.errors.length, 2);
});

test('aborted batches stop rather than publish partial success', async () => {
  const controller = new AbortController();
  controller.abort();
  await assert.rejects(scanBatch(['bread.sui'], {
    signal: controller.signal, resolve: async () => ({}), scan: async () => ({}),
  }), { name: 'AbortError' });
});
