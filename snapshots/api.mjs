import { PAGE_SIZE, pageKey, SCOPES, validRunId } from './schema.mjs';

export async function serveSnapshots(request, storage) {
  const url = new URL(request.url);
  const route = url.pathname.split('/').pop();
  const json = (data, status = 200) => Response.json(data, {
    status, headers: { 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' },
  });
  if (request.method !== 'GET') return json({ error: 'Read-only endpoint.' }, 405);
  try {
    if (route === 'latest') {
      const manifest = storage.latest ? await storage.latest() : await storage.get('latest.json');
      return manifest ? json(manifest) : json({ error: 'No completed snapshot is available yet.' }, 503);
    }
    if (route === 'prices') {
      const id = url.searchParams.get('id');
      if (id && !validRunId(id)) return json({ error: 'Invalid quote ID.' }, 400);
      return json(await storage.get(id ? `quotes/${id}.json` : 'prices.json') || { id: null, quotes: {} });
    }
    if (!['page', 'evidence'].includes(route)) return json({ error: 'Unknown snapshot route.' }, 404);
    const id = url.searchParams.get('id');
    const token = url.searchParams.get('token') || 'WAL';
    const round = url.searchParams.get('round') || 'all';
    const status = url.searchParams.get('status') || 'claimable';
    const scope = `${token}/${round}/${status}`;
    const pageText = url.searchParams.get('page') || '1';
    const page = Number(pageText);
    if (!validRunId(id) || !SCOPES.includes(scope) || !/^[1-9]\d{0,6}$/.test(pageText) || page > 1000000) return json({ error: 'Invalid snapshot query.' }, 400);
    const address = url.searchParams.get('address');
    if (route === 'evidence' && !/^0x[0-9a-f]{64}$/.test(address || '')) return json({ error: 'Invalid address.' }, 400);
    const manifest = await storage.get(`snapshots/${id}/manifest.json`);
    if (!manifest) return json({ error: 'Snapshot unavailable. Refresh to the latest snapshot.' }, 404);
    if (route === 'evidence') {
      const items = await storage.evidence(id, scope, address, page);
      if (items === null) return json({ error: 'Archived evidence is unavailable. Run a live check.' }, 404);
      return json({ id, scope, address, page, items, hasMore: items.length === 100 });
    }
    if (!manifest.scopes?.[scope] || page > manifest.scopes[scope].pages) return json({ error: 'Page not found.' }, 404);
    const result = await storage.get(pageKey(id, scope, page));
    return result ? json({ ...result, pageSize: PAGE_SIZE }) : json({ error: 'Snapshot page unavailable.' }, 503);
  } catch {
    return json({ error: 'Snapshot storage is unavailable. Personal live queries are unaffected.' }, 503);
  }
}
