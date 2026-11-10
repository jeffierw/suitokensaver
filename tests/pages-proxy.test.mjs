import test from 'node:test';
import assert from 'node:assert/strict';
import { onRequest } from '../functions/api/[[path]].js';

test('Pages rejects foreign origins and safely forwards browser same-origin POST', async () => {
  const saved = globalThis.fetch;
  let forwarded;
  globalThis.fetch = async (request) => {
    forwarded = request;
    return Response.json({ ok: true }, { headers: { 'Cache-Control': 'no-store' } });
  };
  try {
    const make = (origin) => new Request('https://suitokensaver.pages.dev/api/scan', {
      method: 'POST', headers: { origin, 'content-type': 'application/json' }, body: '{"address":"0x1"}',
    });
    assert.equal((await onRequest({ request: make('https://evil.example') })).status, 403);
    assert.equal(forwarded, undefined);
    const response = await onRequest({ request: make('https://suitokensaver.pages.dev') });
    assert.equal(response.headers.get('cache-control'), 'no-store');
    assert.equal(forwarded.headers.get('origin'), null);
    assert.equal(await forwarded.text(), '{"address":"0x1"}');
    assert.equal(new URL(forwarded.url).pathname, '/api/scan');
    assert.equal((await onRequest({ request: new Request('https://suitokensaver.pages.dev/api/import') })).status, 404);
  } finally { globalThis.fetch = saved; }
});
