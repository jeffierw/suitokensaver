import { assertRecord, PAGE_SIZE, SCOPES, TOKENS } from './schema.mjs';

export class SnapshotStore {
  constructor(db, runId) {
    this.db = db;
    this.runId = runId;
    for (const sql of [
      'CREATE TABLE IF NOT EXISTS jobs (run TEXT, id TEXT, kind TEXT, source TEXT, cursor TEXT, page INTEGER, scope TEXT, done INTEGER DEFAULT 0, sent INTEGER DEFAULT 0, PRIMARY KEY(run,id))',
      'CREATE INDEX IF NOT EXISTS jobs_due ON jobs(run,done,sent,id)',
      'CREATE INDEX IF NOT EXISTS jobs_kind ON jobs(run,done,kind)',
      'CREATE TABLE IF NOT EXISTS records (run TEXT, id TEXT, address TEXT, symbol TEXT, campaign TEXT, status TEXT, data TEXT, PRIMARY KEY(run,id))',
      'CREATE INDEX IF NOT EXISTS records_owner ON records(run,address,symbol,status,campaign)',
      'CREATE TABLE IF NOT EXISTS holders (run TEXT, scope TEXT, address TEXT, amount TEXT, sortkey TEXT, allocations INTEGER, recovery INTEGER, PRIMARY KEY(run,scope,address))',
      'CREATE INDEX IF NOT EXISTS holders_sort ON holders(run,scope,sortkey DESC,address)',
      'CREATE TABLE IF NOT EXISTS unresolved (run TEXT, source TEXT, id TEXT, data TEXT, PRIMARY KEY(run,source,id))',
      'CREATE TABLE IF NOT EXISTS metadata (id TEXT PRIMARY KEY, data TEXT)',
    ]) db.exec(sql);
  }
  meta(key) { return JSON.parse([...this.db.exec('SELECT data FROM metadata WHERE id=?', key)][0]?.data || 'null'); }
  setMeta(key, value) { this.db.exec('INSERT OR REPLACE INTO metadata VALUES (?,?)', key, JSON.stringify(value)); }
  addJob(job) {
    this.db.exec('INSERT OR IGNORE INTO jobs(run,id,kind,source,cursor,page,scope) VALUES (?,?,?,?,?,?,?)',
      this.runId, job.id, job.kind, job.sourceId || '', job.cursor ?? null, job.page ?? 0, job.scope || '');
  }
  job(id) { return [...this.db.exec('SELECT * FROM jobs WHERE run=? AND id=?', this.runId, id)][0]; }
  pending(kind) {
    return [...this.db.exec(`SELECT * FROM jobs WHERE run=? AND done=0${kind ? ' AND kind=?' : ''} ORDER BY id`,
      this.runId, ...(kind ? [kind] : []))];
  }
  markDone(id) { this.db.exec('UPDATE jobs SET done=1 WHERE run=? AND id=?', this.runId, id); }
  dueJobs(now, limit) {
    return [...this.db.exec('SELECT * FROM jobs WHERE run=? AND done=0 AND sent<? ORDER BY sent,id LIMIT ?', this.runId, now - 60000, limit)];
  }
  hasPending(kind) {
    return [...this.db.exec('SELECT 1 FROM jobs WHERE run=? AND done=0 AND kind=? LIMIT 1', this.runId, kind)].length > 0;
  }
  prune(now, activeRunIds = []) {
    const keepRuns = [...new Set([...activeRunIds, this.meta('latest')?.id].filter(Boolean))];
    return this.db.transaction(() => {
      this.cleanup(keepRuns);
      for (const row of this.db.exec("SELECT id,data FROM metadata WHERE id LIKE 'garbage:%'")) {
        if (JSON.parse(row.data).at < now - 86400000) this.db.exec('DELETE FROM metadata WHERE id=?', row.id);
      }
      for (const row of this.db.exec("SELECT id FROM metadata WHERE id LIKE 'published:%'")) {
        const id = row.id.slice('published:'.length);
        if (keepRuns.includes(id)) continue;
        this.db.exec('DELETE FROM metadata WHERE id=?', row.id);
        this.setMeta(`garbage:${id}`, { at: now });
      }
    });
  }
  commitPage(id, result) {
    return this.db.transaction(() => {
      const job = this.job(id);
      if (!job || job.done) return false;
      if (result.hasNextPage && (!result.endCursor || result.endCursor === job.cursor
          || [...this.db.exec('SELECT id FROM jobs WHERE run=? AND source=? AND cursor=?', this.runId, job.source, result.endCursor)].length)) {
        throw new Error('Snapshot cursor cycle.');
      }
      for (const record of result.records) {
        assertRecord(record);
        const previous = [...this.db.exec('SELECT data FROM records WHERE run=? AND id=?', this.runId, record.objectId)][0];
        if (previous) {
          if (previous.data !== JSON.stringify(record)) throw new Error('Conflicting snapshot object.');
          continue;
        }
        this.db.exec('INSERT INTO records VALUES (?,?,?,?,?,?,?)', this.runId, record.objectId, record.address,
          record.symbol, record.campaignId, record.status, JSON.stringify(record));
        for (const round of ['all', record.campaignId]) {
          const scope = `${record.symbol}/${round}/${record.status}`;
          const current = [...this.db.exec('SELECT * FROM holders WHERE run=? AND scope=? AND address=?', this.runId, scope, record.address)][0];
          const amount = (BigInt(current?.amount || '0') + BigInt(record.amount)).toString();
          if (amount.length > 80) throw new Error('Aggregate amount exceeds supported bounds.');
          this.db.exec('INSERT OR REPLACE INTO holders VALUES (?,?,?,?,?,?,?)', this.runId, scope, record.address,
            amount, amount.padStart(80, '0'), (current?.allocations || 0) + 1,
            (current?.recovery || 0) + Number(!!record.recoveryAvailable));
        }
      }
      for (const item of result.unresolved) {
        this.db.exec('INSERT OR IGNORE INTO unresolved VALUES (?,?,?,?)', this.runId,
          job.source, item.objectId || `page-${job.page}`, JSON.stringify(item));
      }
      this.markDone(id);
      if (result.hasNextPage) this.addJob({
        id: `${job.source}-${job.page + 1}`, kind: 'collect', sourceId: job.source,
        cursor: result.endCursor, page: job.page + 1,
      });
      return true;
    });
  }
  rows(scope, page) {
    if (!SCOPES.includes(scope) || !Number.isSafeInteger(page) || page < 1) throw new Error('Invalid scope/page.');
    return [...this.db.exec('SELECT address,amount,allocations,recovery FROM holders WHERE run=? AND scope=? ORDER BY sortkey DESC,address LIMIT ? OFFSET ?',
      this.runId, scope, PAGE_SIZE, (page - 1) * PAGE_SIZE)];
  }
  evidence(scope, address, page = 1) {
    const [symbol, campaign, status] = scope.split('/');
    return [...this.db.exec(`SELECT data FROM records WHERE run=? AND address=? AND symbol=? AND status=?${campaign === 'all' ? '' : ' AND campaign=?'} ORDER BY id LIMIT ? OFFSET ?`,
      this.runId, address, symbol, status, ...(campaign === 'all' ? [] : [campaign]), 100, (page - 1) * 100)].map((row) => JSON.parse(row.data));
  }
  summary() {
    const scopes = {};
    for (const scope of SCOPES) {
      let amount = 0n;
      let holders = 0;
      let allocations = 0;
      let recoveryAllocations = 0;
      for (const row of this.db.exec('SELECT amount,allocations,recovery FROM holders WHERE run=? AND scope=?', this.runId, scope)) {
        amount += BigInt(row.amount); holders++; allocations += row.allocations; recoveryAllocations += row.recovery;
      }
      scopes[scope] = { amount: amount.toString(), holders, allocations, recoveryAllocations, pages: Math.max(1, Math.ceil(holders / PAGE_SIZE)) };
    }
    const unresolved = [...this.db.exec('SELECT COUNT(*) AS count FROM unresolved WHERE run=?', this.runId)][0].count;
    const holders = [...this.db.exec("SELECT COUNT(DISTINCT address) AS count FROM records WHERE run=? AND status='claimable'", this.runId)][0].count;
    return {
      complete: unresolved === 0, unresolved, holders,
      allocations: TOKENS.reduce((total, symbol) => total + scopes[`${symbol}/all/claimable`].allocations, 0),
      scopes,
    };
  }
  cleanup(keepRuns) {
    const placeholders = keepRuns.map(() => '?').join(',');
    for (const table of ['jobs', 'records', 'holders', 'unresolved']) this.db.exec(`DELETE FROM ${table} WHERE run NOT IN (${placeholders})`, ...keepRuns);
  }
}
