import { DurableObject } from 'cloudflare:workers';
import { SnapshotStore } from '../snapshots/store.mjs';
import { makeRpc, createTransport, collectPage, SNAPSHOT_SOURCES } from '../snapshots/collector.mjs';
import { RUN_LIMIT_MS, SCOPES, validRunId } from '../snapshots/schema.mjs';
import { D1SnapshotStore } from './d1-store.mjs';

export class SnapshotCoordinator extends DurableObject {
  constructor(ctx, env) {
    super(ctx, env);
    this.db = {
      exec: (sql, ...args) => ctx.storage.sql.exec(sql, ...args),
      transaction: (fn) => ctx.storage.transactionSync(fn),
    };
    this.base = new SnapshotStore(this.db, 'metadata');
    this.rpc = makeRpc(createTransport(env));
    this.public = new D1SnapshotStore(env.SNAPSHOTS_DB);
  }
  async ready() { this.readyPromise ||= this.public.ensure(); return this.readyPromise; }
  async fetch(request) {
    const route = new URL(request.url).pathname;
    try {
      if (route === '/latest') {
        await this.ready();
        const latest = await this.public.latest();
        return latest ? Response.json(latest) : new Response('No snapshot', { status: 404 });
      }
      if (route === '/start') return Response.json(await this.start());
      if (route === '/status') {
        const run = this.base.meta('active');
        return Response.json({ run, lastError: this.base.meta('last-error'), jobs: run ? new SnapshotStore(this.db, run.id).pending() : [] });
      }
      if (route === '/step') {
        const job = await request.json();
        await this.step(job);
        return Response.json({ ok: true });
      }
      if (route === '/quotes') {
        await this.ready();
        await this.public.putQuote(await request.json());
        return Response.json({ ok: true });
      }
      if (route === '/evidence') {
        const { id, scope, address, page } = await request.json();
        if (!validRunId(id) || !SCOPES.includes(scope) || !/^0x[0-9a-f]{64}$/.test(address || '')
            || !Number.isSafeInteger(page) || page < 1 || page > 1000000) return new Response('Not found', { status: 404 });
        await this.ready();
        if (!await this.public.manifest(id)) return new Response('Not found', { status: 404 });
        return Response.json(await this.public.evidence(id, scope, address, page));
      }
      return new Response('Not found', { status: 404 });
    } catch (error) {
      this.base.setMeta('last-error', { at: new Date().toISOString(), message: error.message });
      return Response.json({ error: 'Snapshot task failed.' }, { status: 502 });
    }
  }
  async start() {
    await this.ready();
    const existing = this.base.meta('active');
    if (existing && ['starting', 'collecting', 'publishing'].includes(existing.status) && Date.now() < existing.deadline) return existing;
    const run = { id: crypto.randomUUID(), startedAt: Date.now(), deadline: Date.now() + RUN_LIMIT_MS, status: 'starting' };
    this.base.setMeta('active', run);
    this.base.prune(Date.now(), [run.id]);
    await this.ctx.storage.setAlarm(Date.now());
    try {
      run.checkpoint = await this.rpc.head();
      run.status = 'collecting';
      this.db.transaction(() => {
        this.base.setMeta('active', run);
        const store = new SnapshotStore(this.db, run.id);
        for (const source of SNAPSHOT_SOURCES) store.addJob({ id: `${source.id}-0`, sourceId: source.id, kind: 'collect', cursor: null, page: 0 });
      });
      return run;
    } catch (error) {
      this.base.setMeta('active', { ...run, status: 'failed', error: error.message });
      throw error;
    }
  }
  current(id) {
    const run = this.base.meta('active');
    if (!run || run.id !== id || !['collecting', 'publishing'].includes(run.status)) return null;
    if (Date.now() >= run.deadline) {
      this.base.setMeta('active', { ...run, status: 'failed', error: 'Run deadline exceeded.' });
      return null;
    }
    return run;
  }
  async dispatch() {
    const run = this.base.meta('active');
    if (!run || !this.current(run.id)) return;
    const store = new SnapshotStore(this.db, run.id);
    const job = store.dueJobs(Date.now(), 1)[0];
    if (!job) return;
    await this.step({ runId: run.id, jobId: job.id });
    const active = this.base.meta('active');
    if (active?.status === 'collecting' || active?.status === 'publishing') await this.ctx.storage.setAlarm(Date.now() + 1000);
  }
  async alarm() { await this.dispatch(); }
  async step({ runId, jobId }) {
    let run = this.current(runId);
    if (!run) return;
    const store = new SnapshotStore(this.db, runId);
    const job = store.job(jobId);
    if (!job || job.done) { await this.advance(runId); return; }
    if (job.kind === 'collect') {
      const result = await collectPage({ sourceId: job.source, checkpoint: run.checkpoint, cursor: job.cursor }, this.rpc);
      if (!this.current(runId)) return;
      store.commitPage(jobId, result);
      await this.public.putRecords(runId, result.records);
    } else if (job.kind === 'publish') {
      const data = { id: runId, scope: job.scope, page: job.page,
        pages: run.manifest.scopes[job.scope].pages, rows: store.rows(job.scope, job.page) };
      await this.public.putPage(runId, job.scope, job.page, data);
      if (!this.current(runId)) return;
      store.markDone(jobId);
    }
    await this.advance(runId);
    const active = this.base.meta('active');
    if (active?.status === 'collecting' || active?.status === 'publishing') await this.ctx.storage.setAlarm(Date.now() + 1000);
  }
  async advance(runId) {
    let run = this.current(runId);
    if (!run) return;
    const store = new SnapshotStore(this.db, runId);
    if (run.status === 'collecting' && !store.hasPending('collect')) {
      this.db.transaction(() => {
        const manifest = { version: 1, id: runId, checkpoint: run.checkpoint,
          startedAt: new Date(run.startedAt).toISOString(), completedAt: new Date().toISOString(),
          source: 'Sui Mainnet GraphQL', ...store.summary() };
        this.base.setMeta('active', { ...run, status: 'publishing', manifest });
        for (const [scope, summary] of Object.entries(manifest.scopes)) {
          for (let page = 1; page <= summary.pages; page++) store.addJob({ id: `publish-${scope}-${page}`, kind: 'publish', scope, page });
        }
      });
    }
    run = this.current(runId);
    if (run?.status === 'publishing' && !store.hasPending('publish')) {
      await this.public.publish(run.manifest);
      if (!this.current(runId)) return;
      this.db.transaction(() => {
        this.base.setMeta(`published:${runId}`, run.manifest);
        this.base.setMeta('latest', run.manifest);
        this.base.setMeta('active', { ...run, status: 'complete' });
      });
      this.base.prune(Date.now(), [runId]);
      await this.public.prune([runId]);
      await this.ctx.storage.deleteAlarm();
    }
  }
}
