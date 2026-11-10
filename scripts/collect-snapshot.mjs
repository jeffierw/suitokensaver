import { mkdir, writeFile, rename } from 'node:fs/promises';
import path from 'node:path';
import { createTransport, makeRpc, collectPage, SNAPSHOT_SOURCES } from '../snapshots/collector.mjs';
import { SnapshotStore } from '../snapshots/store.mjs';
import { openDatabase } from '../snapshots/local-db.mjs';
import { RUN_LIMIT_MS, pageKey } from '../snapshots/schema.mjs';
import { fetchQuotes } from '../snapshots/prices.mjs';

const root = path.resolve(process.env.SNAPSHOT_DIR || '.snapshots');
await mkdir(root, { recursive: true });
const db = openDatabase(path.join(root, 'state.sqlite'));
const rpc = makeRpc(createTransport(process.env));
let store = new SnapshotStore(db, 'bootstrap');
const resume = process.argv.includes('--resume');
let run = resume ? store.meta('active') : null;
if (!run || run.status !== 'collecting') {
  run = { id: crypto.randomUUID(), startedAt: Date.now(), checkpoint: await rpc.head(), status: 'collecting' };
  store.setMeta('active', run);
}
store = new SnapshotStore(db, run.id);
for (const source of SNAPSHOT_SOURCES) store.addJob({ id: `${source.id}-0`, kind: 'collect', sourceId: source.id, page: 0, cursor: null });
const maxPages = Number(process.env.SNAPSHOT_MAX_PAGES || 100000);
let done = 0;
async function save(key, value) {
  const file = path.join(root, key);
  await mkdir(path.dirname(file), { recursive: true });
  const temporary = `${file}.${crypto.randomUUID()}.tmp`;
  await writeFile(temporary, JSON.stringify(value));
  await rename(temporary, file);
}
try {
  while (store.pending('collect').length) {
    if (Date.now() - run.startedAt >= RUN_LIMIT_MS) throw new Error('Snapshot deadline exceeded; old snapshot retained.');
    if (done >= maxPages) throw new Error('Page budget reached; unpublished partial run can be resumed before its deadline.');
    const jobs = store.pending('collect').slice(0, Math.min(4, maxPages - done));
    await Promise.all(jobs.map(async (job) => {
      let result;
      for (let attempt = 0; attempt < 3; attempt++) {
        try { result = await collectPage({ sourceId: job.source, checkpoint: run.checkpoint, cursor: job.cursor }, rpc); break; }
        catch (error) {
          if (attempt === 2) throw error;
          await new Promise((resolve) => setTimeout(resolve, 2000 * (attempt + 1)));
        }
      }
      store.commitPage(job.id, result);
      done++;
      if (job.page % 20 === 0) console.log(JSON.stringify({ source: job.source, page: job.page, records: result.records.length, unresolved: result.unresolved.length, elapsedSeconds: Math.round((Date.now() - run.startedAt) / 1000) }));
    }));
  }
  const manifest = { version: 1, id: run.id, checkpoint: run.checkpoint, startedAt: new Date(run.startedAt).toISOString(),
    completedAt: new Date().toISOString(), source: 'Sui Mainnet GraphQL', ...store.summary() };
  for (const [scope, summary] of Object.entries(manifest.scopes)) {
    for (let page = 1; page <= summary.pages; page++) await save(pageKey(run.id, scope, page), {
      id: run.id, scope, page, pages: summary.pages, rows: store.rows(scope, page),
    });
  }
  if (Date.now() - run.startedAt >= RUN_LIMIT_MS) throw new Error('Publication deadline exceeded; old snapshot retained.');
  await save(`snapshots/${run.id}/manifest.json`, manifest);
  store.setMeta(`published:${run.id}`, manifest);
  await save('latest.json', manifest);
  store.setMeta('active', { ...run, status: 'complete' });
  try {
    const prices = await fetchQuotes(process.env);
    await save(`quotes/${prices.id}.json`, prices);
    await save('prices.json', prices);
  } catch (error) { console.error('Prices unavailable:', error.message); }
  console.log(JSON.stringify({ published: run.id, checkpoint: run.checkpoint, holders: manifest.holders,
    allocations: manifest.allocations, complete: manifest.complete, unresolved: manifest.unresolved,
    amounts: Object.fromEntries(['WAL', 'DEEP', 'NS'].map((token) => [token, manifest.scopes[`${token}/all/claimable`].amount])) }, null, 2));
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
} finally { db.close(); }
