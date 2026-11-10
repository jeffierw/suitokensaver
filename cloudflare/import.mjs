import { D1SnapshotStore } from './d1-store.mjs';
import { digest } from '../snapshots/packed.mjs';

export async function handleImport(request, env) {
  const supplied = request.headers.get('Authorization') || '';
  if (!env.SNAPSHOT_IMPORT_TOKEN || await digest(supplied) !== await digest(`Bearer ${env.SNAPSHOT_IMPORT_TOKEN}`)) {
    return new Response('Not found', { status: 404 });
  }
  if (request.method !== 'POST') return new Response('Method not allowed', { status: 405 });
  try {
    const reader = request.body?.getReader();
    if (!reader) return new Response('Missing body', { status: 400 });
    const chunks = [];
    let size = 0;
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > 6 * 1024 * 1024) {
        await reader.cancel();
        return new Response('Body too large', { status: 413 });
      }
      chunks.push(value);
    }
    const body = JSON.parse(await new Blob(chunks).text());
    const store = new D1SnapshotStore(env.SNAPSHOTS_DB);
    const route = new URL(request.url).pathname.split('/').pop();
    let result;
    if (route === 'begin') result = await store.begin(body.manifest);
    else if (route === 'artifacts') result = await store.upload(body.id, body.artifacts);
    else if (route === 'publish') result = await store.publish(body.id);
    else if (route === 'cleanup') result = await store.cleanup();
    else return new Response('Not found', { status: 404 });
    return Response.json(result);
  } catch (error) {
    console.error('Snapshot import rejected:', error.message);
    return Response.json({ error: 'Snapshot import rejected; check worker logs.' }, { status: 409 });
  }
}
