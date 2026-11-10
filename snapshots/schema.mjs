import { CAMPAIGNS, UNKNOWN_WAL } from '../shared/campaigns.mjs';

export const TOKENS = ['WAL', 'DEEP', 'NS'];
export const PAGE_SIZE = 25;
export const RUN_LIMIT_MS = 40 * 60 * 1000;
export const SCOPES = TOKENS.flatMap((symbol) =>
  ['all', ...[...CAMPAIGNS, UNKNOWN_WAL].filter((entry) => entry.symbol === symbol).map((entry) => entry.id)]
    .flatMap((round) => ['claimable', 'locked'].map((status) => `${symbol}/${round}/${status}`)));
export const validRunId = (id) => typeof id === 'string' && /^[a-zA-Z0-9-]{1,80}$/.test(id);
export function pageKey(id, scope, page) {
  if (!validRunId(id) || !SCOPES.includes(scope) || !Number.isSafeInteger(page) || page < 1 || page > 1000000) throw new Error('Invalid snapshot page.');
  return `snapshots/${id}/${scope}/${page}.json`;
}
export function assertRecord(record) {
  if (!/^0x[0-9a-f]{64}$/.test(record?.objectId || '') || !/^0x[0-9a-f]{64}$/.test(record?.address || '')
      || !SCOPES.includes(`${record.symbol}/${record.campaignId}/${record.status}`)
      || !/^[0-9]{1,20}$/.test(record.amount || '') || BigInt(record.amount) <= 0n
      || BigInt(record.amount) > 18446744073709551615n) throw new Error('Invalid allocation record.');
}
