import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { serveSnapshots } from '../snapshots/api.mjs';
import { openDatabase } from '../snapshots/local-db.mjs';
import { SnapshotStore } from '../snapshots/store.mjs';

const directory = path.resolve(process.env.SNAPSHOT_DIR || '.snapshots');
export async function handleSnapshot(request, response) {
  if (process.env.SNAPSHOT_API_URL) {
    try {
      const url = new URL(request.originalUrl, process.env.SNAPSHOT_API_URL);
      const upstream = await fetch(url, { signal: AbortSignal.timeout(15000) });
      response.status(upstream.status).type('json').send(await upstream.text());
    } catch { response.status(503).json({ error: 'Snapshot service unavailable. Live queries are unaffected.' }); }
    return;
  }
  const storage = {
    async get(key) {
      try { return JSON.parse(await readFile(path.join(directory, key), 'utf8')); }
      catch (error) { if (error.code === 'ENOENT') return null; throw error; }
    },
    async evidence(id, scope, address, page) {
      let db;
      try {
        db = openDatabase(path.join(directory, 'state.sqlite'));
        const store = new SnapshotStore(db, id);
        if (!store.meta(`published:${id}`)) return null;
        return store.evidence(scope, address, page);
      } finally { db?.close(); }
    },
  };
  const result = await serveSnapshots(new Request(`http://localhost${request.originalUrl}`, { method: request.method }), storage);
  response.status(result.status).type('json').send(await result.text());
}
