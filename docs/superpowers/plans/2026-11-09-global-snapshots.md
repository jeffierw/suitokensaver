# Global Snapshots Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. No commits or remote deployment without user authorization.

**Goal:** Publish honest six-hour airdrop snapshots and paginated address lists while retaining independent live address checks.

**Architecture:** A checkpoint-bound collector enumerates funding objects and wrappers. Cloudflare Cron and Queues run bounded work; a SQLite-backed Durable Object coordinates idempotency and aggregation; R2 holds versioned summaries and pages. React consumes snapshot data separately from the existing live scan API.

**Tech Stack:** Existing Node 22/React/Vite JavaScript ESM; Wrangler, Workers, Queues, SQLite Durable Objects and R2.

**Spec:** ../specs/2026-11-09-global-snapshots-design.md

## Global Constraints

- Existing live scanner must never read snapshot eligibility.
- Scheduled chain refresh: every six hours; price refresh: ten minutes.
- Each scan uses a fixed checkpoint; initial hard deadline: 40 minutes.
- Do not silently fall back to latest state if checkpoint retention expires.
- Page size: 25 addresses; descending exact token amount, ascending address tie-break.
- Default view: verified positive unlocked allocations. Locked values separate.
- Missing evidence/price is not zero. Incomplete valuation is not a complete total.
- WAL unknown rounds remain visible and count only toward verified token totals.
- No wallet writes, mock public totals, or unverified cloud deployment claims.

## Review Focus

- Duplicate Queue delivery must not increase amounts or holder counts.
- Expired checkpoints and failed pages must never replace the last good snapshot.
- Page navigation must retain snapshot and price versions.
- Very large base-unit amounts must never pass through floating-point sums.
- Live verification must remain independent of an old global row.

## Task 1: Checkpoint-Bound Candidate Collector

Files: create `snapshots/collector.mjs`, `tests/snapshot-collector.test.mjs`.
Consume campaign type allowlists and `classifyLocked` / `classifyWrapper`.
Produce `collectPage({sourceId, checkpoint, cursor}, rpc)` returning
`{records, unresolved, endCursor, hasNextPage}`.

- [ ] Write fixtures for mismatched NFT links, false owner/type, claimed NFT,
  absent funding, incomplete page and expired checkpoint. Assert invalid evidence
  never contributes a verified amount; all RPC reads use the same checkpoint.
- [ ] Run `npm test`; observe new failures.
- [ ] Enumerate WAL/DEEP S1 Locked objects, batch-fetch referenced NFTs at the same
  checkpoint, and check both references and actual balances. Enumerate initial
  DEEP/NS wrappers directly. Resolve WAL round evidence conservatively.
- [ ] Expose checkpoint-bound query execution through an injected RPC transport;
  do not change current live scanner query semantics.
- [ ] Run `npm test`; expect all tests passing.

## Task 2: Exact Aggregation And Snapshot Artifacts

Files: create `snapshots/aggregate.mjs`, `snapshots/schema.mjs`,
`tests/snapshot-aggregate.test.mjs`.
Consume collector records with source, object ID, address, token, campaign,
status, amount and evidence. Produce summaries and 25-row pages by scope.

- [ ] Write tests for repeated object IDs, one address across rounds/tokens,
  amounts above Number.MAX_SAFE_INTEGER, amount ties and page boundaries.
  Assert global holders use a set union and duplicate records do not add value.
- [ ] Run `npm test`; observe failures.
- [ ] Define versioned manifests with checkpoint/time, completeness, unresolved
  counts, per-token totals, supported coverage and immutable page keys.
- [ ] Implement exact base-unit aggregation and sorting; expand allocation
  evidence on demand without downloading all holders into the browser.
- [ ] Run `npm test`; expect all tests passing.

## Task 3: Durable Cloudflare Pipeline

Files: create `cloudflare/worker.mjs`, `cloudflare/coordinator.mjs`,
`wrangler.jsonc`, `tests/cloudflare/`; update package scripts and .gitignore.
Consume `collectPage` and snapshot aggregation contracts.
Produce immutable R2 artifacts and a latest-successful manifest endpoint.

- [ ] Add Workers runtime tests for duplicate jobs, crash after page persistence,
  retry exhaustion, overlapping schedules, checkpoint eviction and expired runs.
  Assert latest-successful remains unchanged until every required page is stored.
- [ ] Run new runtime tests; observe failures before implementing handlers.
- [ ] Use deterministic run/source/page job IDs and transactional SQLite inserts.
  Aggregate with BigInt in bounded chunks; store exact decimal strings and padded
  numeric sort keys, never SQLite REAL or overflowing INTEGER totals.
- [ ] Implement durable dispatch/outbox recovery, bounded Queue consumers,
  retries/dead-letter handling, run deadlines and retention checks.
- [ ] Publish immutable R2 artifacts first, then update the pointer through the
  serialized coordinator. Public routes are read-only; collection triggers are
  internal bindings, not an unauthenticated public endpoint.
- [ ] Add local Wrangler configuration and bounded local run command.
  No guessed account IDs or remote resource creation.
- [ ] Run runtime tests and local Worker smoke checks; expect passing results.

## Task 4: Price Quotes And Snapshot API

Files: create `snapshots/prices.mjs`, `server/snapshots.mjs`,
`tests/snapshot-prices.test.mjs`, `tests/snapshot-api.test.mjs`;
modify `server/index.mjs` and `.env.example`.

- [ ] Verify a production quote provider's WAL, DEEP and NS identifiers against
  official token types, timestamp fields and access limits. Archive evidence;
  if access is unavailable, keep USD values explicitly unavailable.
- [ ] Test missing/stale/wrong-token/negative quotes and mixed coverage;
  expect null estimates and explicit coverage, never zero-valued substitutions.
- [ ] Implement fixed-decimal price conversion and ten-minute quote refresh with
  timestamp/source; proposed quote freshness ceiling is twenty minutes.
- [ ] Serve summary and allowlisted token/round/status page queries pinned to
  manifest and quote IDs. Reject arbitrary R2 paths and oversized page requests.
- [ ] Test upstream failure, invalid scopes, stale manifest and absent snapshots.
- [ ] Run `npm test`; expect all tests passing.

## Task 5: Category Address Lists

Files: create `src/SnapshotExplorer.jsx`, `src/snapshots.mjs`;
modify `src/main.jsx`, `src/style.css`, `tests/browser/scanner.spec.js`.
Consume only the new snapshot API for global data; use existing live scan flow
when a user explicitly requests live verification.

- [ ] Add browser tests for token/round/status switching, 25-row pagination,
  expanded evidence, absent/partial/stale snapshots and out-of-order requests.
- [ ] Observe failures before implementation.
- [ ] Add global summary, WAL/DEEP/NS tabs, round/status selects and address rows
  with amounts, optional USD values, allocation counts, copy/explorer controls,
  expandable evidence and a live-check command.
- [ ] Keep results and timestamps for live checks separate from snapshot rows.
  Reset page on scope/snapshot changes; maintain version across navigation.
- [ ] Test a stale row whose current on-chain amount changed; live result must
  show new evidence without silently editing old global totals.
- [ ] Run unit/browser tests and build. Inspect desktop and mobile screenshots.

## Task 6: Full-Run Verification And Deployment Gate

Files: add runbook `docs/snapshots-operations.md`; update README and research.

- [ ] Run a resumable bounded full traversal using the intended production data
  provider; measure object count, RPC calls, wall time, unresolved evidence and
  artifact size. Ordered probes cannot substitute for full-population totals.
- [ ] Verify it finishes within checkpoint retention/deadline; otherwise stop
  publication and document the need for a longer-retention provider.
- [ ] Compare sample aggregate rows with evidence at the published checkpoint,
  verify holder union and sum reconciliation, then separately test live queries.
- [ ] Authenticate/select the user's Cloudflare account, confirm resource names
  and service costs, and obtain deployment authorization before provisioning.
- [ ] After authorized deployment, exercise a manual run, verify R2 manifest
  serving and Cron configuration. Never claim a scheduled cycle ran without logs.

## Preflight Evidence And Execution Status

Updated 2026-11-10: tasks 1-5 are implemented. Full local traversal succeeded;
see the progress ledger and `../../snapshots-operations.md` for measured results
and verification coverage. Original fine-grained checkboxes below/above are not
a claim that every planned fault-injection scenario has been executed. Cloud
deployment, full production throughput and operational cost checks remain gated.

- Design approved by the user on 2026-11-09.
- Read-only feasibility probe complete; see
  `../../research/2026-11-09-snapshot-feasibility.md`.
- Fixed-checkpoint enumeration and multi-get work on public mainnet GraphQL.
- Full local traversal found 66,598 verified allocations across 65,415 holders.
  Global statistics are published locally, not on Cloudflare.
- Local Cloudflare authentication/configuration was not found in standard places.
- Final independent review completed; bounded scheduling and old-run retention
  findings were fixed with regression coverage. No commits or cloud deployment.
