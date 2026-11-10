import { SCOPES, validRunId } from './schema.mjs';

export const EVIDENCE_BUCKETS = 1024;
export const MAX_ARTIFACTS = 12000;
export const MAX_ARTIFACT_BYTES = 512 * 1024;
export const MAX_SNAPSHOT_BYTES = 180 * 1024 * 1024;
export const evidenceBucket = (address) => Number.parseInt(address.slice(-3), 16) % EVIDENCE_BUCKETS;
export const byteLength = (text) => new TextEncoder().encode(text).length;
export async function digest(text) {
  const bytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return Array.from(new Uint8Array(bytes), (value) => value.toString(16).padStart(2, '0')).join('');
}
export function validateManifest(manifest) {
  if (!manifest || manifest.version !== 2 || !validRunId(manifest.id) || manifest.complete !== true
      || manifest.unresolved !== 0 || !Number.isSafeInteger(Number(manifest.checkpoint?.sequenceNumber))
      || !Number.isFinite(Date.parse(manifest.checkpoint?.timestamp))
      || !Number.isFinite(Date.parse(manifest.completedAt))
      || !Number.isSafeInteger(manifest.holders) || manifest.holders < 0
      || !Number.isSafeInteger(manifest.allocations) || manifest.allocations < 0
      || Object.keys(manifest.scopes || {}).length !== SCOPES.length) throw new Error('Invalid complete manifest.');
  let count = EVIDENCE_BUCKETS;
  for (const scope of SCOPES) {
    const entry = manifest.scopes[scope];
    if (!entry || !/^\d{1,80}$/.test(entry.amount) || !Number.isSafeInteger(entry.holders) || entry.holders < 0
        || !Number.isSafeInteger(entry.allocations) || entry.allocations < 0
        || entry.pages !== Math.max(1, Math.ceil(entry.holders / 25))) throw new Error('Invalid scope summary.');
    count += entry.pages;
  }
  if (count > MAX_ARTIFACTS) throw new Error('Snapshot exceeds free-plan artifact budget.');
  return count;
}
export function artifactKeyValid(key, manifest) {
  const evidence = /^evidence\/(0|[1-9]\d*)$/.exec(key);
  if (evidence) return Number(evidence[1]) < EVIDENCE_BUCKETS;
  const page = /^page\/(.+)\/([1-9]\d*)$/.exec(key);
  return !!page && SCOPES.includes(page[1]) && Number(page[2]) <= manifest.scopes[page[1]].pages;
}
