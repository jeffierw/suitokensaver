CREATE TABLE IF NOT EXISTS packed_runs (
  id TEXT PRIMARY KEY,
  manifest TEXT NOT NULL,
  expected INTEGER NOT NULL,
  received INTEGER NOT NULL DEFAULT 0,
  bytes INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL CHECK (status IN ('staging','published')),
  started INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS packed_artifacts (
  run TEXT NOT NULL,
  key TEXT NOT NULL,
  data TEXT NOT NULL,
  digest TEXT NOT NULL,
  bytes INTEGER NOT NULL,
  PRIMARY KEY (run,key)
) WITHOUT ROWID;
CREATE TABLE IF NOT EXISTS packed_state (key TEXT PRIMARY KEY, value TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS packed_quotes (id TEXT PRIMARY KEY, data TEXT NOT NULL, created INTEGER NOT NULL);
CREATE TRIGGER IF NOT EXISTS packed_artifact_insert AFTER INSERT ON packed_artifacts
BEGIN
  UPDATE packed_runs SET received=received+1, bytes=bytes+NEW.bytes WHERE id=NEW.run;
  SELECT CASE WHEN (SELECT bytes FROM packed_runs WHERE id=NEW.run)>188743680
    THEN RAISE(ABORT,'Snapshot byte budget exceeded') END;
END;
