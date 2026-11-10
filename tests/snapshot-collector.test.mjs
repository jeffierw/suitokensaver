import test from 'node:test';
import assert from 'node:assert/strict';
import { collectPage, makeRpc } from '../snapshots/collector.mjs';
import { SOURCES } from '../shared/campaigns.mjs';

const address = `0x${'1'.repeat(64)}`;
const nftId = `0x${'2'.repeat(64)}`;
const lockedId = `0x${'3'.repeat(64)}`;
const source = SOURCES.find((entry) => entry.id === 'deep-s1');
const node = (id, type, json, owner = { __typename: 'AddressOwner', address: { address } }) => ({
  address: id, owner, asMoveObject: { contents: { type: { repr: type }, json: { id, ...json } } },
});
function fixture(change = () => {}) {
  const locked = node(lockedId, `${source.packageId}::airdrop::Locked`, { nft: nftId, balance: '123000000' }, { __typename: 'Shared' });
  const nft = node(nftId, source.type, { locked_id: lockedId, allocation_withdrawn: false, initial_allocation: '123000000' });
  const config = node(source.configId, `${source.packageId}::config::AirdropConfig`, { unlock_timestamp_ms: '1', recovery_timestamp_ms: '9999999999999' }, { __typename: 'Shared' });
  change({ locked, nft, config });
  return {
    page: async () => ({ nodes: [locked], pageInfo: { hasNextPage: false, endCursor: null } }),
    objects: async () => [nft, config],
    creation: async () => null,
  };
}
const args = { sourceId: 'deep-s1', checkpoint: { sequenceNumber: 123, timestamp: '2026-11-09T00:00:00Z' }, cursor: null };

test('funded NFT produces one exact snapshot allocation', async () => {
  const result = await collectPage(args, fixture());
  assert.equal(result.records.length, 1);
  assert.equal(result.records[0].amount, '123000000');
  assert.equal(result.records[0].address, address);
  assert.equal(result.unresolved.length, 0);
});

test('missing or mismatched evidence cannot contribute value', async () => {
  for (const change of [
    ({ nft }) => { nft.asMoveObject.contents.json.locked_id = address; },
    ({ nft }) => { nft.owner = { __typename: 'Shared' }; },
    ({ locked }) => { locked.asMoveObject.contents.type.repr = 'fake'; },
    ({ config }) => { config.asMoveObject.contents.type.repr = 'fake'; },
    ({ nft }) => { nft.asMoveObject.contents.json.allocation_withdrawn = true; },
  ]) {
    const result = await collectPage(args, fixture(change));
    assert.equal(result.records.length, 0);
    assert.equal(result.unresolved.length, 1);
  }
});

test('failed pagination fails the page, never returns empty success', async () => {
  await assert.rejects(collectPage(args, { ...fixture(), page: async () => ({ nodes: [] }) }), /pagination/i);
});

test('every transport read is scoped to the requested checkpoint', async () => {
  const requests = [];
  const rpc = makeRpc(async (query, variables) => {
    requests.push({ query, variables });
    return { checkpoint: { query: { objects: { nodes: [], pageInfo: { hasNextPage: false } }, multiGetObjects: [] } } };
  });
  await rpc.page(source.type, 123, null);
  await rpc.objects([nftId], 123);
  assert.ok(requests.every(({ query, variables }) => query.includes('checkpoint(sequenceNumber:$checkpoint)') && variables.checkpoint === 123));
  await assert.rejects(makeRpc(async () => ({ checkpoint: null })).page(source.type, 123, null), /checkpoint/i);
});
