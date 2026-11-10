const SCHEMA = [
  'CREATE TABLE IF NOT EXISTS snapshot_meta (key TEXT PRIMARY KEY, data TEXT NOT NULL)',
  'CREATE TABLE IF NOT EXISTS snapshot_manifests (id TEXT PRIMARY KEY, data TEXT NOT NULL, published_at INTEGER NOT NULL)',
  'CREATE TABLE IF NOT EXISTS snapshot_pages (run TEXT NOT NULL, scope TEXT NOT NULL, page INTEGER NOT NULL, data TEXT NOT NULL, PRIMARY KEY (run, scope, page))',
  'CREATE TABLE IF NOT EXISTS snapshot_records (run TEXT NOT NULL, id TEXT NOT NULL, address TEXT NOT NULL, symbol TEXT NOT NULL, campaign TEXT NOT NULL, status TEXT NOT NULL, data TEXT NOT NULL, PRIMARY KEY (run, id))',
  'CREATE INDEX IF NOT EXISTS snapshot_records_evidence ON snapshot_records (run, address, symbol, campaign, status, id)',
  'CREATE TABLE IF NOT EXISTS snapshot_quotes (id TEXT PRIMARY KEY, data TEXT NOT NULL, fetched_at INTEGER NOT NULL)',
];

const batch = async (db, statements, size = 50) => {
  for (let index = 0; index < statements.length; index += size) await db.batch(statements.slice(index, index + size));
};

export class D1SnapshotStore {
  constructor(db) { this.db = db; }
  async ensure() { for (const sql of SCHEMA) await this.db.exec(sql); }
  async putRecords(run, records) {
    await batch(this.db, records.map((record) => this.db.prepare(
      'INSERT OR REPLACE INTO snapshot_records(run,id,address,symbol,campaign,status,data) VALUES (?,?,?,?,?,?,?)',
    ).bind(run, record.objectId, record.address, record.symbol, record.campaignId, record.status, JSON.stringify(record))));
  }
  async putPage(run, scope, page, data) {
    await this.db.prepare('INSERT OR REPLACE INTO snapshot_pages(run,scope,page,data) VALUES (?,?,?,?)')
      .bind(run, scope, page, JSON.stringify(data)).run();
  }
  async publish(manifest) {
    const data = JSON.stringify(manifest);
    await this.db.batch([
      this.db.prepare('INSERT OR REPLACE INTO snapshot_manifests(id,data,published_at) VALUES (?,?,?)').bind(manifest.id, data, Date.now()),
      this.db.prepare('INSERT OR REPLACE INTO snapshot_meta(key,data) VALUES (?,?)').bind('latest', data),
    ]);
  }
  async latest() {
    const row = await this.db.prepare("SELECT data FROM snapshot_meta WHERE key='latest'").first();
    return row ? JSON.parse(row.data) : null;
  }
  async manifest(id) { const row = await this.db.prepare('SELECT data FROM snapshot_manifests WHERE id=?').bind(id).first(); return row ? JSON.parse(row.data) : null; }
  async page(id, scope, page) { const row = await this.db.prepare('SELECT data FROM snapshot_pages WHERE run=? AND scope=? AND page=?').bind(id, scope, page).first(); return row ? JSON.parse(row.data) : null; }
  async evidence(id, scope, address, page) {
    const [symbol, campaign, status] = scope.split('/');
    const sql = `SELECT data FROM snapshot_records WHERE run=? AND address=? AND symbol=? AND status=?${campaign === 'all' ? '' : ' AND campaign=?'} ORDER BY id LIMIT ? OFFSET ?`;
    const values = [id, address, symbol, status, ...(campaign === 'all' ? [] : [campaign]), 100, (page - 1) * 100];
    const result = await this.db.prepare(sql).bind(...values).all();
    return result.results.map((row) => JSON.parse(row.data));
  }
  async putQuote(quote) {
    const data = JSON.stringify(quote);
    await this.db.batch([
      this.db.prepare('INSERT OR REPLACE INTO snapshot_quotes(id,data,fetched_at) VALUES (?,?,?)').bind(quote.id, data, Date.now()),
      this.db.prepare('INSERT OR REPLACE INTO snapshot_meta(key,data) VALUES (?,?)').bind('prices', data),
    ]);
  }
  async quote(id) {
    const row = id
      ? await this.db.prepare('SELECT data FROM snapshot_quotes WHERE id=?').bind(id).first()
      : await this.db.prepare("SELECT data FROM snapshot_meta WHERE key='prices'").first();
    return row ? JSON.parse(row.data) : null;
  }
  async get(key) {
    if (key === 'latest.json') return this.latest();
    if (key === 'prices.json') return this.quote();
    const quote = /^quotes\/([a-zA-Z0-9-]{1,80})\.json$/.exec(key);
    if (quote) return this.quote(quote[1]);
    const manifest = /^snapshots\/([a-zA-Z0-9-]{1,80})\/manifest\.json$/.exec(key);
    if (manifest) return this.manifest(manifest[1]);
    const page = /^snapshots\/([a-zA-Z0-9-]{1,80})\/(.+)\/(\d+)\.json$/.exec(key);
    return page ? this.page(page[1], page[2], Number(page[3])) : null;
  }
  async prune(keep) {
    const kept = [...new Set(keep)];
    if (!kept.length) return;
    const marks = kept.map(() => '?').join(',');
    await this.db.batch([
      this.db.prepare(`DELETE FROM snapshot_pages WHERE run NOT IN (${marks})`).bind(...kept),
      this.db.prepare(`DELETE FROM snapshot_records WHERE run NOT IN (${marks})`).bind(...kept),
      this.db.prepare(`DELETE FROM snapshot_manifests WHERE id NOT IN (${marks})`).bind(...kept),
    ]);
  }
}
