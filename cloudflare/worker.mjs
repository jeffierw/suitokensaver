import { SnapshotCoordinator } from './coordinator.mjs';
import { serveSnapshots } from '../snapshots/api.mjs';
import { fetchQuotes } from '../snapshots/prices.mjs';

export { SnapshotCoordinator };
const coordinator = (env) => env.COORDINATOR.get(env.COORDINATOR.idFromName('global'));

export default {
  async fetch(request, env) {
    if (!new URL(request.url).pathname.startsWith('/api/snapshots/')) return new Response('Not found', { status: 404 });
    const stub = coordinator(env);
    return serveSnapshots(request, {
      get: async (key) => (await env.SNAPSHOTS.get(key))?.json() || null,
      latest: async () => {
        const response = await stub.fetch('https://internal/latest');
        return response.ok ? response.json() : null;
      },
      evidence: async (id, scope, address, page) => {
        const response = await stub.fetch('https://internal/evidence', {
          method: 'POST', body: JSON.stringify({ id, scope, address, page }),
        });
        return response.ok ? response.json() : null;
      },
    });
  },
  async scheduled(event, env, context) {
    if (event.cron === '0 */6 * * *') {
      context.waitUntil(coordinator(env).fetch('https://internal/start', { method: 'POST' }).then((response) => {
        if (!response.ok) throw new Error('Snapshot start failed.');
      }));
    } else {
      context.waitUntil((async () => {
        const quotes = await fetchQuotes(env);
        await env.SNAPSHOTS.put(`quotes/${quotes.id}.json`, JSON.stringify(quotes), { httpMetadata: { contentType: 'application/json' } });
        await env.SNAPSHOTS.put('prices.json', JSON.stringify(quotes), { httpMetadata: { contentType: 'application/json' } });
      })());
    }
  },
  async queue(batch, env) {
    for (const message of batch.messages) {
      try {
        const response = await coordinator(env).fetch('https://internal/step', { method: 'POST', body: JSON.stringify(message.body) });
        if (!response.ok) throw new Error('Snapshot job failed.');
        message.ack();
      } catch { message.retry({ delaySeconds: 30 }); }
    }
  },
};
