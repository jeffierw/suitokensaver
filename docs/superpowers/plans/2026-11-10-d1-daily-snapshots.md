# D1 Daily Snapshots Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace R2 and Queues with D1-backed daily global airdrop snapshots.

**Architecture:** The existing SQLite Durable Object remains a short-lived job
coordinator. D1 holds published run metadata, scope summaries, paginated holder
rows, evidence and quotes. Scheduled daily collection starts a checkpoint-pinned
run; Durable Object alarms advance bounded pages without a Queue.

**Tech Stack:** Cloudflare Workers, Durable Objects SQLite, D1, Cron, Node 22,
JavaScript ESM, Miniflare, existing Sui Mainnet GraphQL collector.

**Spec:** ../specs/2026-11-10-d1-daily-snapshots-design.md

## Global Constraints

- Keep personal `/api/scan` live, read-only and independent of D1 snapshots.
- Keep GraphQL RPC; Sui JSON-RPC is deprecated.
- Snapshot Cron is `0 2 * * *`; quote Cron remains `*/10 * * * *`.
- Retain latest published D1 run plus one active run only.
- Do not publish partial or unresolved-as-zero data.
- Use exact decimal strings and padded sort keys; never SQLite numeric totals.
- Remove R2 and Queue bindings and never create their remote resources.
- Do not deploy until unit/browser/Miniflare verification and user authorization.

## Review Focus

- A failed D1 write or checkpoint expiry must retain the prior published run.
- A duplicate/stale alarm step must not double-count or republish a run.
- D1 pagination must remain pinned to a historical run ID, not latest data.
- Daily Cron must not treat the 10-minute quote schedule as a collection trigger.
- Pruning cannot delete the latest successful run while an active run is in progress.

### Task 1: D1 Publication Store

**Files:**
- Create: `cloudflare/d1-store.mjs`
- Create: `cloudflare/schema.sql`
- Test: `tests/cloudflare/d1-store.test.mjs`

**Interfaces:**
- Consumes: complete manifest and `SnapshotStore` records/holder rows.
- Produces: `D1SnapshotStore.publish(run, manifest, store)`, `latest()`,
  `page(id, scope, page)`, `evidence(id, scope, address, page)`, `quotes()`.

- [ ] Write failing D1 tests for atomic publication, exact string amounts,
  run-pinned pagination and pruning preserving latest/active runs.
- [ ] Run `node --test tests/cloudflare/d1-store.test.mjs`; expect missing
  module/API failures.
- [ ] Create schema tables and implement parameterized D1 queries; page holder
  rows with `LIMIT 25 OFFSET`, and publish all scope summaries/records in a
  D1 batch before changing the latest pointer.
- [ ] Run the focused D1 tests; expect pass.
- [ ] Commit the isolated D1 store change.

### Task 2: Alarm-Driven Coordinator

**Files:**
- Modify: `cloudflare/coordinator.mjs`
- Modify: `cloudflare/worker.mjs`
- Modify: `tests/cloudflare/pipeline.test.mjs`

**Interfaces:**
- Consumes: `D1SnapshotStore` from Task 1; existing `SnapshotStore` job state.
- Produces: durable coordinator `/latest` and `/evidence` reads backed by D1;
  `advance()` publishes through D1; `alarm()` performs bounded collection/publish steps.

- [ ] Write failing runtime tests that start a run without `SCAN_JOBS`, process
  it via alarms/`step`, retain latest after failure, and reject a stale step.
- [ ] Run `npm run test:cloudflare`; expect failures caused by removed Queue/R2
  assumptions.
- [ ] Replace Queue send dispatch with alarm-driven bounded in-object processing;
  publish D1 only after all collection jobs finish; write quotes to D1.
- [ ] Run Cloudflare runtime tests; expect pass.
- [ ] Commit coordinator and Worker migration.

### Task 3: D1 Public API And Configuration

**Files:**
- Modify: `snapshots/api.mjs`
- Modify: `cloudflare/worker.mjs`
- Modify: `wrangler.jsonc`
- Modify: `.env.example`
- Test: `tests/snapshot-api.test.mjs`

**Interfaces:**
- Consumes: D1 `latest/page/evidence/quotes` storage adapter.
- Produces: unchanged read-only `/api/snapshots/latest`, `page`, `evidence`,
  `prices` responses pinned to D1 run IDs.

- [ ] Write failing tests for D1 quote reads, missing D1 snapshot behavior and
  rejecting arbitrary scope/page inputs.
- [ ] Run `npm test`; expect new adapter/config assertions to fail.
- [ ] Adapt the snapshot API and Worker binding to `env.SNAPSHOTS_DB`; remove
  `r2_buckets`, `queues`, queue consumer, `SNAPSHOTS` binding and Queue paths;
  set daily collection Cron.
- [ ] Run `npm test` and `npm run cf:build`; expect pass with no R2 binding.
- [ ] Commit public API/config migration.

### Task 4: UI And Operations Alignment

**Files:**
- Modify: `README.md`
- Modify: `docs/snapshots-operations.md`
- Modify: `docs/superpowers/plans/2026-11-09-global-snapshots-progress.md`
- Test: `tests/browser/snapshots.spec.js`

**Interfaces:**
- Consumes: unchanged HTTP snapshot API contracts.
- Produces: accurate operational guidance and browser coverage independent of
  storage provider.

- [ ] Write/update a browser assertion that daily snapshot data still renders
  when served by the unchanged API contract.
- [ ] Run `npm run test:browser`; expect its existing API fixture to remain
  applicable or update only its storage-specific wording.
- [ ] Remove R2/Queue operating instructions; document D1 setup, D1 free-limit
  monitoring, daily cadence and no-zero-cost guarantee.
- [ ] Run browser tests and production build; expect pass.
- [ ] Commit documentation/UI alignment.

### Task 5: Full Verification And Deployment Gate

**Files:**
- Modify: `docs/snapshots-operations.md`

**Interfaces:**
- Consumes: the D1 Worker configuration and all prior tests.
- Produces: a deployment checklist with exact required D1 resource name and
  no R2 subscription dependency.

- [ ] Run `npm test`, `npm run test:cloudflare`, `npm run test:browser`,
  `npm run build` and inspect a real-data local screenshot.
- [ ] Verify `wrangler.jsonc` has no R2 or Queue binding and list the exact D1
  creation/deployment commands without executing remote writes.
- [ ] Update the deployment gate with test evidence and D1 usage-monitoring
  requirements.
- [ ] Commit final migration work.
