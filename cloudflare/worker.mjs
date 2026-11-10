import { SnapshotCoordinator } from './coordinator.mjs';
import { serveSnapshots } from '../snapshots/api.mjs';
import { fetchQuotes } from '../snapshots/prices.mjs';
import { D1SnapshotStore } from './d1-store.mjs';

export { SnapshotCoordinator };
const coordinator = (env) => env.COORDINATOR.get(env.COORDINATOR.idFromName('global'));

export default {
  async fetch(request, env) {
    if (!new URL(request.url).pathname.startsWith('/api/snapshots/')) return new Response('Not found', { status: 404 });
    const stub = coordinator(env);
    const snapshots = new D1SnapshotStore(env.SNAPSHOTS_DB);
    await snapshots.ensure();
    return serveSnapshots(request, {
      get: (key) => snapshots.get(key),
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
    if (event.cron === '0 2 * * *') {
      context.waitUntil(coordinator(env).fetch('https://internal/start', { method: 'POST' }).then((response) => {
        if (!response.ok) throw new Error('Snapshot start failed.');
      }));
    } else {
      context.waitUntil((async () => {
        const quotes = await fetchQuotes(env);
        const response = await coordinator(env).fetch('https://internal/quotes', { method: 'POST', body: JSON.stringify(quotes) });
        if (!response.ok) throw new Error('Snapshot quote update failed.');
      })());
    }
  },
};
