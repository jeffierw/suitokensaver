# D1 Daily Snapshots Design

## Intent

Replace the planned R2 and Cloudflare Queue snapshot artifact pipeline with a
single D1-backed read model. The user wants a daily refresh cadence and to avoid
enabling the R2 usage-billed subscription. Personal address lookups remain live,
read-only Sui GraphQL queries and never use D1 eligibility results.

## Goals

- Store the latest complete global WAL, DEEP and NS snapshot in D1.
- Trigger a full fixed-checkpoint collection once each day at 02:00 UTC.
- Serve category, amount and address pagination from D1.
- Keep snapshot publication atomic: incomplete/failed data never replaces the
  latest published snapshot.
- Remove R2 and Queue bindings, resources and documentation requirements.
- Keep exact amounts as decimal strings and use lexically padded sort keys.

## Non-Goals

- Guarantee a zero Cloudflare bill. D1 free limits, Worker CPU and Durable Object
  allowances depend on the account plan and must be monitored after deployment.
- Retain every historical full snapshot. D1 retains the latest completed run and
  one active run only.
- Change live scanner behavior, connect wallets, sign transactions, or submit claims.

## Approaches Considered

1. **Retain R2 plus Queue:** scalable immutable page archive, but requires the
   R2 subscription activation the user does not want.
2. **D1 plus Durable Object, recommended:** D1 holds public query records and
   metadata; a Durable Object coordinates short collection batches through
   alarms. It removes R2 and Queue, makes SQL pagination direct, and supports
   the current latest-only product view. It requires a migration and careful
   runtime-limit monitoring.
3. **D1-only Cron:** simpler configuration, but a full scan measured about
   17 minutes and cannot safely run in one scheduled Worker invocation.

The chosen approach is D1 plus Durable Object with a daily Cron. The coordinator
processes bounded pages per alarm and resumes until it completes or hits the
existing 40-minute checkpoint deadline. A failed run preserves the current
published run.

## Data Model

The coordinator's SQLite Durable Object remains its job/outbox coordinator.
D1 receives only publication-ready data:

- `snapshot_runs`: run ID, fixed checkpoint, timestamps, completeness,
  unresolved count and publication state.
- `snapshot_scopes`: exact amount, holder/allocation counts and page count for
  each `token/round/status` scope.
- `snapshot_holders`: one row per run/scope/address with exact amount, padded
  sort key, allocation count and recovery count.
- `snapshot_records`: evidence rows keyed by run/object ID.
- `snapshot_quotes`: periodic quote snapshots and one latest pointer.

Publishing copies a complete run into D1 transactionally, updates the latest
pointer only after all scope data is present, then clears older D1 run data.
Reads always pin pages and evidence to an explicit run ID.

## Operations

- Snapshot Cron: `0 2 * * *` (02:00 UTC / 10:00 Asia/Shanghai).
- Price Cron: `*/10 * * * *`.
- Daily collection produces approximately 66,598 records from the measured run.
- Monitor D1 rows read/written, database size, Worker CPU time, failed alarms,
  latest-snapshot age and stale prices. Disable the schedule if actual account
  usage exceeds free limits.
- No remote Cloudflare resources are created until after implementation,
  verification and the user's explicit deployment request.

## Acceptance Criteria

- No `r2_buckets`, Queue bindings or R2 API calls remain.
- Local Cloudflare tests cover D1 publication, failed-run retention, exact
  pagination, stale job rejection and latest-only cleanup.
- Existing live scanner tests continue to pass unchanged.
- Worker deployment configuration validates without an R2 subscription.
