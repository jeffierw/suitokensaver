CREATE TABLE IF NOT EXISTS snapshot_meta (key TEXT PRIMARY KEY, data TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS snapshot_manifests (id TEXT PRIMARY KEY, data TEXT NOT NULL, published_at INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS snapshot_pages (run TEXT NOT NULL, scope TEXT NOT NULL, page INTEGER NOT NULL, data TEXT NOT NULL, PRIMARY KEY (run, scope, page));
CREATE TABLE IF NOT EXISTS snapshot_records (run TEXT NOT NULL, id TEXT NOT NULL, address TEXT NOT NULL, symbol TEXT NOT NULL, campaign TEXT NOT NULL, status TEXT NOT NULL, data TEXT NOT NULL, PRIMARY KEY (run, id));
CREATE INDEX IF NOT EXISTS snapshot_records_evidence ON snapshot_records (run, address, symbol, campaign, status, id);
CREATE TABLE IF NOT EXISTS snapshot_quotes (id TEXT PRIMARY KEY, data TEXT NOT NULL, fetched_at INTEGER NOT NULL);
