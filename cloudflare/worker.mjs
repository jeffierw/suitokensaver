import { handleImport } from './import.mjs';
import { serveSnapshots } from '../snapshots/api.mjs';
import { refreshPrices } from '../snapshots/refresh-prices.mjs';
import { D1SnapshotStore } from './d1-store.mjs';
import { handleLiveApi } from '../worker/live-api.mjs';
import { resolveName } from '../server/chain.mjs';
import { scanAddress } from '../server/scanner.mjs';

let priceRequest;

export default {
  async fetch(request, env) {
    const path = new URL(request.url).pathname;
    if (path.startsWith('/internal/snapshot/')) return handleImport(request, env);
    if (path === '/api/resolve' || path === '/api/scan') return handleLiveApi(request, { resolveName, scanAddress });
    if (!path.startsWith('/api/snapshots/')) return new Response('Not found', { status: 404 });
    const snapshots = new D1SnapshotStore(env.SNAPSHOTS_DB);
    if (path === '/api/snapshots/prices' && request.method === 'GET' && !new URL(request.url).searchParams.has('id')) {
      try {
        priceRequest ||= refreshPrices(snapshots).finally(() => { priceRequest = null; });
        return Response.json(await priceRequest, { headers: { 'Cache-Control': 'no-store' } });
      } catch {
        return serveSnapshots(request, snapshots);
      }
    }
    return serveSnapshots(request, snapshots);
  },
  async scheduled(event, env, context) {
    context.waitUntil((async () => {
      const store = new D1SnapshotStore(env.SNAPSHOTS_DB);
      await refreshPrices(store);
      await store.cleanup();
    })());
  },
};
