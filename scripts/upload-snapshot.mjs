import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { openDatabase } from '../snapshots/local-db.mjs';
import { EVIDENCE_BUCKETS, evidenceBucket, byteLength, MAX_ARTIFACT_BYTES, MAX_SNAPSHOT_BYTES, validateManifest } from '../snapshots/packed.mjs';

const root = path.resolve(process.env.SNAPSHOT_DIR || '.snapshots');
const endpoint = process.env.SNAPSHOT_IMPORT_URL;
const token = process.env.SNAPSHOT_IMPORT_TOKEN;
if (!endpoint || !token || new URL(endpoint).protocol !== 'https:') throw new Error('HTTPS import URL and token required.');
const manifest = { ...JSON.parse(await readFile(path.join(root, 'latest.json'), 'utf8')), version: 2 };
validateManifest(manifest);
const artifacts = [];
for (const [scope, summary] of Object.entries(manifest.scopes)) {
  for (let page = 1; page <= summary.pages; page++) {
    artifacts.push({ key: `page/${scope}/${page}`, data: await readFile(path.join(root, `snapshots/${manifest.id}/${scope}/${page}.json`), 'utf8') });
  }
}
const db = openDatabase(path.join(root, 'state.sqlite'));
const buckets = Array.from({ length: EVIDENCE_BUCKETS }, () => []);
try {
  for (const row of db.exec('SELECT data FROM records WHERE run=? ORDER BY id', manifest.id)) {
    const record = JSON.parse(row.data);
    buckets[evidenceBucket(record.address)].push(record);
  }
} finally { db.close(); }
buckets.forEach((records, index) => artifacts.push({ key: `evidence/${index}`, data: JSON.stringify(records) }));
let totalBytes = 0;
for (const artifact of artifacts) {
  const bytes = byteLength(artifact.data);
  if (bytes > MAX_ARTIFACT_BYTES) throw new Error(`Artifact too large: ${artifact.key}`);
  totalBytes += bytes;
}
if (totalBytes > MAX_SNAPSHOT_BYTES || artifacts.length !== validateManifest(manifest)) throw new Error('Snapshot exceeds import budget.');
async function post(route, body) {
  for (let attempt = 0; attempt < 4; attempt++) {
    try {
      const response = await fetch(`${endpoint}/internal/snapshot/${route}`, {
        method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(body), signal: AbortSignal.timeout(60000),
      });
      if (!response.ok) throw new Error(`Import ${route}: HTTP ${response.status}`);
      return await response.json();
    } catch (error) {
      if (attempt === 3) throw error;
      await new Promise((resolve) => setTimeout(resolve, 2000 * (attempt + 1)));
    }
  }
}
await post('begin', { manifest });
let rowsWritten = 0;
for (let offset = 0; offset < artifacts.length; offset += 10) {
  const result = await post('artifacts', { id: manifest.id, artifacts: artifacts.slice(offset, offset + 10) });
  rowsWritten += result.rowsWritten;
  if (offset % 500 === 0) console.log(JSON.stringify({ uploaded: offset, total: artifacts.length, rowsWritten }));
}
await post('publish', { id: manifest.id });
for (let batch = 0; batch < 70; batch++) {
  if (!(await post('cleanup', {})).more) break;
}
console.log(JSON.stringify({ published: manifest.id, artifacts: artifacts.length, bytes: totalBytes, rowsWritten }));
