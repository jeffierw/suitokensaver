import test from 'node:test';
import assert from 'node:assert/strict';
import { parseInputs, formatAmount, normalizeInput } from '../shared/validation.mjs';

test('accepts names and full addresses, canonicalizes and deduplicates', () => {
  const address = `0x${'ab'.repeat(32)}`;
  const result = parseInputs(`@bread\nbread.sui,${address};${address.toUpperCase().replace('0X', '0x')}`);
  assert.equal(result.valid.length, 2);
  assert.equal(result.duplicates, 2);
  assert.equal(result.valid[0].value, 'bread.sui');
});

test('rejects shortened wallet addresses, malicious text and malformed names', () => {
  for (const value of ['0xabc', '0x12...34', '<script>', 'https://foo.sui', '@', '-bread.sui']) {
    assert.equal(normalizeInput(value).valid, false, value);
  }
});

test('reports invalid entries without discarding valid entries', () => {
  const result = parseInputs('bread.sui\ninvalid');
  assert.equal(result.valid.length, 1);
  assert.equal(result.invalid.length, 1);
});

test('rejects empty and over-limit batches', () => {
  assert.ok(parseInputs('').error);
  assert.ok(parseInputs(Array.from({ length: 21 }, (_, index) => `name${index}.sui`).join('\n')).error);
});

test('formats integer amounts without losing precision', () => {
  assert.equal(formatAmount('18446744073709551615', 9), '18,446,744,073.709551615');
  assert.equal(formatAmount('198165393', 6), '198.165393');
  assert.equal(formatAmount('0', 9), '0');
  assert.throws(() => formatAmount('garbage', 9));
});
