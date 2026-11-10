import { artifactKeyValid, byteLength, digest, evidenceBucket, MAX_ARTIFACT_BYTES, validateManifest } from '../snapshots/packed.mjs';

const written = (results) => results.reduce((total, result) => total + (result.meta?.rows_written || 0), 0);

export class D1SnapshotStore {
  constructor(db) { this.db = db; }
  async state(key) {
    return (await this.db.prepare('SELECT value FROM packed_state WHERE key=?').bind(key).first())?.value || null;
  }
  async run(id) {
    return this.db.prepare('SELECT * FROM packed_runs WHERE id=?').bind(id).first();
  }
  async begin(manifest, now = Date.now()) {
    const expected = validateManifest(manifest);
    const existing = await this.run(manifest.id);
    if (existing) {
      if (existing.manifest !== JSON.stringify(manifest)) throw new Error('Conflicting manifest.');
      if (existing.status !== 'published' && await this.state('active') !== manifest.id) throw new Error('Inactive staging run.');
      return { id: manifest.id, status: existing.status, received: existing.received };
    }
    const latest = await this.latest();
    if (latest && Number(latest.checkpoint.sequenceNumber) >= Number(manifest.checkpoint.sequenceNumber)) throw new Error('Snapshot checkpoint is not newer.');
    const day = new Date(now).toISOString().slice(0, 10);
    const results = await this.db.batch([
      this.db.prepare(`INSERT INTO packed_runs(id,manifest,expected,status,started)
        SELECT ?,?,?,'staging',? WHERE COALESCE((SELECT value FROM packed_state WHERE key='day'),'') < ?`)
        .bind(manifest.id, JSON.stringify(manifest), expected, now, day),
      this.db.prepare("INSERT OR REPLACE INTO packed_state(key,value) SELECT 'day',? WHERE EXISTS(SELECT 1 FROM packed_runs WHERE id=?)").bind(day, manifest.id),
      this.db.prepare("INSERT OR REPLACE INTO packed_state(key,value) SELECT 'active',? WHERE EXISTS(SELECT 1 FROM packed_runs WHERE id=?)").bind(manifest.id, manifest.id),
    ]);
    if (!await this.run(manifest.id)) throw new Error('Daily import budget already reserved.');
    return { id: manifest.id, status: 'staging', rowsWritten: written(results) };
  }
  async upload(id, artifacts) {
    const run = await this.run(id);
    if (!run || run.status !== 'staging' || await this.state('active') !== id) throw new Error('Run is not active staging or is already published.');
    if (!Array.isArray(artifacts) || artifacts.length < 1 || artifacts.length > 10) throw new Error('Invalid artifact batch.');
    const manifest = JSON.parse(run.manifest);
    const statements = [];
    for (const artifact of artifacts) {
      if (!artifactKeyValid(artifact.key, manifest) || typeof artifact.data !== 'string'
          || byteLength(artifact.data) > MAX_ARTIFACT_BYTES) throw new Error('Invalid artifact key or size.');
      const hash = await digest(artifact.data);
      const existing = await this.db.prepare('SELECT digest FROM packed_artifacts WHERE run=? AND key=?').bind(id, artifact.key).first();
      if (existing) {
        if (existing.digest !== hash) throw new Error('Conflicting artifact retry.');
        continue;
      }
      const data = JSON.parse(artifact.data);
      if (artifact.key.startsWith('page/')) {
        const parts = artifact.key.split('/');
        const scope = parts.slice(1, 4).join('/');
        if (data.id !== id || data.scope !== scope || data.page !== Number(parts[4])
            || data.pages !== manifest.scopes[scope].pages || !Array.isArray(data.rows) || data.rows.length > 25) throw new Error('Invalid page artifact.');
      } else if (!Array.isArray(data)) throw new Error('Invalid evidence artifact.');
      statements.push(this.db.prepare(`INSERT OR IGNORE INTO packed_artifacts(run,key,data,digest,bytes)
        SELECT ?,?,?,?,? WHERE EXISTS(SELECT 1 FROM packed_runs WHERE id=? AND status='staging')
        AND (SELECT value FROM packed_state WHERE key='active')=?`)
        .bind(id, artifact.key, artifact.data, hash, byteLength(artifact.data), id, id));
    }
    const results = statements.length ? await this.db.batch(statements) : [];
    return { rowsWritten: written(results) };
  }
  async publish(id) {
    const run = await this.run(id);
    if (!run) throw new Error('Unknown run.');
    if (run.status === 'published') return { id, status: 'published' };
    if (run.received !== run.expected || await this.state('active') !== id) throw new Error('Snapshot is incomplete or inactive.');
    const latest = await this.latest();
    if (latest && Number(latest.checkpoint.sequenceNumber) >= Number(JSON.parse(run.manifest).checkpoint.sequenceNumber)) throw new Error('Snapshot checkpoint is not newer.');
    const results = await this.db.batch([
      this.db.prepare(`UPDATE packed_runs SET status='published' WHERE id=? AND received=expected
        AND (SELECT value FROM packed_state WHERE key='active')=?`).bind(id, id),
      this.db.prepare(`INSERT OR REPLACE INTO packed_state(key,value) SELECT 'latest',id FROM packed_runs
        WHERE id=? AND status='published' AND (SELECT value FROM packed_state WHERE key='active')=?`).bind(id, id),
    ]);
    if (await this.state('latest') !== id) throw new Error('Publication lost active-run ownership.');
    return { id, status: 'published', rowsWritten: written(results) };
  }
  async cleanup() {
    const results = await this.db.batch([
      this.db.prepare(`DELETE FROM packed_artifacts WHERE (run,key) IN (SELECT run,key FROM packed_artifacts
        WHERE run NOT IN (SELECT value FROM packed_state WHERE key IN ('latest','active')) LIMIT 200)`),
      this.db.prepare(`DELETE FROM packed_runs WHERE id NOT IN (SELECT value FROM packed_state WHERE key IN ('latest','active'))
        AND NOT EXISTS(SELECT 1 FROM packed_artifacts WHERE run=packed_runs.id)`),
    ]);
    return { more: results[0].meta.changes === 200, rowsWritten: written(results) };
  }
  async latest() {
    const id = await this.state('latest');
    return id ? this.manifest(id) : null;
  }
  async manifest(id) {
    const row = await this.db.prepare("SELECT manifest FROM packed_runs WHERE id=? AND status='published'").bind(id).first();
    return row ? JSON.parse(row.manifest) : null;
  }
  async artifact(id, key) {
    const row = await this.db.prepare('SELECT data FROM packed_artifacts WHERE run=? AND key=?').bind(id, key).first();
    return row ? JSON.parse(row.data) : null;
  }
  async page(id, scope, page) { return this.artifact(id, `page/${scope}/${page}`); }
  async evidence(id, scope, address, page) {
    const records = await this.artifact(id, `evidence/${evidenceBucket(address)}`);
    if (!records) return null;
    const [symbol, campaign, status] = scope.split('/');
    return records.filter((record) => record.address === address && record.symbol === symbol
      && record.status === status && (campaign === 'all' || record.campaignId === campaign))
      .sort((left, right) => left.objectId.localeCompare(right.objectId))
      .slice((page - 1) * 100, page * 100);
  }
  async putQuote(quote) {
    const now = Date.now();
    await this.db.batch([
      this.db.prepare('INSERT OR REPLACE INTO packed_quotes(id,data,created) VALUES (?,?,?)').bind(quote.id, JSON.stringify(quote), now),
      this.db.prepare("INSERT OR REPLACE INTO packed_state(key,value) VALUES ('prices',?)").bind(quote.id),
      this.db.prepare('DELETE FROM packed_quotes WHERE created<?').bind(now - 86400000),
    ]);
  }
  async quote(id) {
    id ||= await this.state('prices');
    if (!id) return null;
    const row = await this.db.prepare('SELECT data FROM packed_quotes WHERE id=?').bind(id).first();
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
}
