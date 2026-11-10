import test from 'node:test';
import assert from 'node:assert/strict';
import { Miniflare } from 'miniflare';

test('durable pipeline publishes once, rejects stale jobs, and preserves last success on failure', async () => {
  let fail = false;
  const mf = new Miniflare({
    modules: true, scriptPath: '.wrangler/build/worker.js', compatibilityDate: '2026-05-03',
    durableObjects: { COORDINATOR: { className: 'SnapshotCoordinator', useSQLite: true } },
    d1Databases: { SNAPSHOTS_DB: 'snapshot-test' },
    bindings: { SUI_GRAPHQL_URL: 'https://test-rpc.local' },
    outboundService: async (request) => {
      if (fail) return new Response('unavailable', { status: 503 });
      const { query, variables } = await request.json();
      const ns = variables?.type?.endsWith('::distribution::NSWrapper');
      const data = query.includes('objects(first:50')
        ? { checkpoint: { query: { objects: { nodes: ns ? Array.from({ length: 30 }, (_, index) => ({
          address: `0x${String(index + 1).padStart(64, '0')}`, owner: { __typename: 'AddressOwner', address: { address: `0x${String(index + 1).padStart(64, '0')}` } },
          asMoveObject: { contents: { type: { repr: variables.type }, json: { id: `0x${String(index + 1).padStart(64, '0')}`, balance: '123000000' } } },
        })) : [], pageInfo: { hasNextPage: false, endCursor: null } } } } }
        : query.includes('multiGetObjects') ? { checkpoint: { query: { multiGetObjects: [null] } } }
        : { checkpoint: { sequenceNumber: 123, timestamp: new Date().toISOString() } };
      return Response.json({ data });
    },
  });
  try {
    const namespace = await mf.getDurableObjectNamespace('COORDINATOR');
    const stub = namespace.get(namespace.idFromName('global'));
    const call = async (route, body) => stub.fetch(`http://internal/${route}`, { method: 'POST', body: JSON.stringify(body || {}) });
    const started = await (await call('start')).json();
    const same = await (await call('start')).json();
    assert.equal(started.id, same.id);
    let firstJob;
    for (let turn = 0; turn < 100; turn++) {
      const state = await (await call('status')).json();
      if (state.run.status === 'complete') break;
      if (state.run.status === 'publishing') assert.ok(state.jobs.filter((job) => job.scope === 'NS/all/claimable').length <= 2);
      for (const job of state.jobs) {
        firstJob ||= job;
        const response = await call('step', { runId: started.id, jobId: job.id });
        assert.equal(response.status, 200, JSON.stringify(await (await call('status')).json()));
      }
    }
    const latest = await (await stub.fetch('http://internal/latest')).json();
    assert.equal(latest.id, started.id);
    assert.equal(latest.holders, 30);
    assert.equal(latest.scopes['NS/all/claimable'].amount, '3690000000');
    const page = await (await mf.dispatchFetch(`http://local/api/snapshots/page?id=${started.id}&token=${'N' + 'S'}`)).json();
    const publishedPage = page;
    assert.equal(publishedPage.rows[0].amount, '123000000');
    assert.equal((await (await mf.dispatchFetch(`http://local/api/snapshots/page?id=${started.id}&token=${'N' + 'S'}&page=2`)).json()).rows.length, 5);
    assert.equal((await call('step', { runId: started.id, jobId: firstJob.id })).status, 200);
    const replacement = await (await call('start')).json();
    for (let turn = 0; turn < 100; turn++) {
      const state = await (await call('status')).json();
      if (state.run.status === 'complete') break;
      for (const job of state.jobs) assert.equal((await call('step', { runId: replacement.id, jobId: job.id })).status, 200);
    }
    const evidence = { scope: 'NS/all/claimable', address: `0x${'1'.padStart(64, '0')}`, page: 1 };
    assert.equal((await call('evidence', { ...evidence, id: started.id })).status, 404);
    assert.equal((await call('evidence', { ...evidence, id: replacement.id })).status, 200);
    assert.equal((await call('step', { runId: started.id, jobId: firstJob.id })).status, 200);
    fail = true;
    assert.equal((await call('start')).status, 502);
    const preserved = await (await stub.fetch('http://internal/latest')).json();
    assert.equal(preserved.id, replacement.id);
    assert.equal((await mf.dispatchFetch('http://local/api/start', { method: 'POST' })).status, 404);
  } finally { await mf.dispose(); }
});
