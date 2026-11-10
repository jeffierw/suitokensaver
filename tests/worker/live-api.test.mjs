import test from 'node:test';
import assert from 'node:assert/strict';
import { handleLiveApi } from '../../worker/live-api.mjs';

const address = `0x${'a'.repeat(64)}`;
const dependencies = { resolveName: async () => address, scanAddress: async () => ({ address, complete: true, groups: [] }) };
const request = (path, body, headers = {}) => new Request(`https://example.pages.dev${path}`, { method: 'POST', headers: { 'content-type': 'application/json', ...headers }, body: JSON.stringify(body) });

test('worker live API resolves names and scans full addresses with safe headers', async () => {
  const resolved = await handleLiveApi(request('/api/resolve', { input: '@alice' }), dependencies);
  assert.deepEqual(await resolved.json(), { input: '@alice', name: 'alice.sui', address });
  const scanned = await handleLiveApi(request('/api/scan', { address }), dependencies);
  assert.equal(scanned.status, 200);
  assert.equal(scanned.headers.get('cache-control'), 'no-store');
});

test('worker live API rejects invalid input, foreign origin and failed scans', async () => {
  assert.equal((await handleLiveApi(request('/api/scan', { address: '0x1' }), dependencies)).status, 400);
  assert.equal((await handleLiveApi(request('/api/scan', { address }, { origin: 'https://evil.example' }), dependencies)).status, 403);
  assert.equal((await handleLiveApi(request('/api/scan', { address }, { origin: 'https://example.pages.dev' }), { ...dependencies, scanAddress: async () => { throw new Error('upstream'); } })).status, 502);
});
