import test from 'node:test';
import assert from 'node:assert/strict';
import { claimAction, deepClaimPrompt, visibleCampaigns } from '../src/claims.mjs';
test('only matching categories or explicit failures are shown', () => {
  const campaigns = ['empty', 'found', 'failed'].map((id) => ({ id }));
  const batch = { results: [{ groups: [
    { campaignId: 'empty', complete: true, errors: [], items: [] },
    { campaignId: 'found', complete: true, errors: [], items: [{ status: 'claimed' }] },
    { campaignId: 'failed', complete: false, errors: ['Provider failure'], items: [] },
  ] }] };
  assert.deepEqual(visibleCampaigns(campaigns, batch).map(({ id }) => id), ['found', 'failed']);
  assert.deepEqual(visibleCampaigns(campaigns, batch, 'claimable').map(({ id }) => id), ['failed']);
});
test('claim actions use exact official links and exclude nonclaimable records', () => {
  for (const status of ['claimed', 'locked', 'empty', 'unverifiable']) assert.equal(claimAction({ status, amount: '1' }, { symbol: 'WAL' }), null);
  assert.equal(claimAction({ status: 'claimable', amount: '1' }, { symbol: 'NS' }).url, 'https://claim.suins.io/');
  assert.equal(claimAction({ status: 'claimable', amount: '1' }, { symbol: 'WAL' }).url, 'https://claim.walrus.xyz/');
  assert.equal(claimAction({ status: 'claimable', amount: '1' }, { symbol: 'DEEP' }).kind, 'agent');
});
test('DEEP prompt carries evidence, requests simulation and never prescribes an invented claim function', () => {
  const prompt = deepClaimPrompt({ address: '0xabc', checkpoint: 123 }, { objectId: '0xdef', status: 'claimable', amount: '100' }, { id: 'deep-s1', decimals: 6 }, '简体中文');
  assert.match(prompt, /0xabc/);
  assert.match(prompt, /0xdef/);
  assert.match(prompt, /simulate it first/);
  assert.match(prompt, /Never ask for a seed phrase/);
});
