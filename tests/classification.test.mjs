import test from 'node:test';
import assert from 'node:assert/strict';
import { classifyLocked, classifyWrapper, walRound } from '../server/classify.mjs';

const nft = { id: 'nft', locked_id: 'locked', initial_allocation: '123', allocation_withdrawn: false };
const locked = { id: 'locked', nft: 'nft', balance: '123' };
const config = { unlock_timestamp_ms: '1000', recovery_timestamp_ms: '2000' };

test('recovery availability is not automatic expiry', () => {
  assert.equal(classifyLocked(nft, locked, config, 3000).status, 'claimable');
  assert.equal(classifyLocked(nft, locked, config, 3000).recoveryAvailable, true);
});
test('claimed receipt is not an unclaimed allocation', () => {
  assert.equal(classifyLocked({ ...nft, allocation_withdrawn: true }, null, config, 3000).status, 'claimed');
});
test('missing funds are not claimed or claimable', () => {
  assert.equal(classifyLocked(nft, null, config, 3000).status, 'unverifiable');
});
test('malformed state and mismatched evidence fail closed', () => {
  assert.equal(classifyLocked(nft, { ...locked, nft: 'other' }, config, 3000).status, 'unverifiable');
  assert.equal(classifyLocked({ ...nft, allocation_withdrawn: 'false' }, locked, config, 3000).status, 'unverifiable');
  assert.equal(classifyLocked(nft, locked, {}, 3000).status, 'unverifiable');
  assert.equal(classifyLocked(nft, { ...locked, balance: '-1' }, config, 3000).status, 'unverifiable');
});
test('future unlock stays locked', () => {
  assert.equal(classifyLocked(nft, locked, config, 500).status, 'locked');
});
test('wrapper uses actual balance and receipt uses amount', () => {
  assert.equal(classifyWrapper({ balance: '123' }, false).status, 'claimable');
  assert.equal(classifyWrapper({ amount: '123' }, true).status, 'claimed');
  assert.equal(classifyWrapper({ balance: '0' }, false).status, 'empty');
  assert.equal(classifyWrapper({}, false).status, 'unverifiable');
});
test('WAL classification uses creation time, not last activity', () => {
  assert.equal(walRound('2025-03-20T00:00:00Z'), 'wal-launch');
  assert.equal(walRound('2025-08-21T16:32:16Z'), 'wal-stakers');
  assert.equal(walRound(null), 'wal-unknown');
  assert.equal(walRound('2026-11-09T00:00:00Z'), 'wal-unknown');
});
test('launch WAL NFTs were distributed before the March token launch', () => {
  assert.equal(walRound('2025-02-19T03:26:46.214Z'), 'wal-launch');
});
