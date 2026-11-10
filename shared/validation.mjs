import { isValidSuiAddress, normalizeSuiAddress, isValidSuiNSName, normalizeSuiNSName } from '@mysten/sui/utils';

export const MAX_INPUTS = 20;

export function normalizeInput(raw) {
  if (typeof raw !== 'string') return { valid: false, error: 'Enter an address or SuiNS name.' };
  const input = raw.trim();
  if (/^0x[0-9a-f]{64}$/i.test(input) && isValidSuiAddress(input)) {
    return { valid: true, kind: 'address', input, value: normalizeSuiAddress(input) };
  }
  if (isValidSuiNSName(input)) {
    return { valid: true, kind: 'name', input, value: normalizeSuiNSName(input, 'dot') };
  }
  return { valid: false, input, error: 'Use a full 0x address, name.sui or @name.' };
}

export function parseInputs(text) {
  if (typeof text !== 'string' || text.length > 12000) {
    return { valid: [], invalid: [], duplicates: 0, error: 'Input is too large.' };
  }
  const tokens = text.trim().split(/[\s,;，；]+/u).filter(Boolean);
  const valid = [];
  const invalid = [];
  const seen = new Set();
  let duplicates = 0;
  for (const token of tokens) {
    const entry = normalizeInput(token);
    if (!entry.valid) {
      invalid.push(entry);
    } else if (seen.has(entry.value)) {
      duplicates++;
    } else {
      seen.add(entry.value);
      valid.push(entry);
    }
  }
  const error = tokens.length === 0 ? 'Enter at least one address or SuiNS name.'
    : valid.length > MAX_INPUTS ? `A batch can contain up to ${MAX_INPUTS} unique addresses or names.` : null;
  return { valid, invalid, duplicates, error };
}

export function formatAmount(value, decimals) {
  if (!/^\d+$/.test(String(value)) || !Number.isInteger(decimals) || decimals < 0 || decimals > 18) {
    throw new Error('Invalid token amount');
  }
  const digits = BigInt(value).toString().padStart(decimals + 1, '0');
  const whole = decimals ? digits.slice(0, -decimals) : digits;
  const fraction = decimals ? digits.slice(-decimals).replace(/0+$/, '') : '';
  return whole.replace(/\B(?=(\d{3})+(?!\d))/g, ',') + (fraction ? `.${fraction}` : '');
}
