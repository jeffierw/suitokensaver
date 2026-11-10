import assert from 'node:assert/strict';
import { resolveName } from '../server/chain.mjs';
import { scanAddress } from '../server/scanner.mjs';

const samples = [
  ['0x6195c3465b81d074822dadcd610e0dc7e33acdf4377f9f5d65a966cfa0f88cf9', [
    ['wal-launch', 'claimed'], ['wal-stakers', 'claimed'], ['deep-s1', 'claimable'], ['ns-launch', 'claimed'],
  ]],
  ['0xa8d0f8ed496c67db3586eb6a0df682714f18b8e4ca3ea8a877788b5cae1fb5ed', [['deep-launch', 'claimable']]],
  ['0x0495ecdda5686b0fe4872bf8ac33733c39b0eba70bffee692a694140614e76a9', [['ns-launch', 'claimable']]],
];
assert.match(await resolveName('bread.sui'), /^0x[0-9a-f]{64}$/);
console.log('PASS: live SuiNS resolution');
for (const [address, expected] of samples) {
  const result = await scanAddress(address);
  assert.equal(result.complete, true, JSON.stringify(result.groups));
  for (const [campaignId, status] of expected) {
    assert.ok(result.groups.find((group) => group.campaignId === campaignId)?.items.some((item) => item.status === status),
      `${campaignId}: the sample may have changed on-chain; inspect before updating this check.`);
  }
  console.log(JSON.stringify({
    address, checkpoint: result.checkpoint, complete: result.complete,
    results: result.groups.map((group) => ({ campaign: group.campaignId, items: group.items.map(({ status, amount, objectId }) => ({ status, amount, objectId })) })),
  }, null, 2));
}
