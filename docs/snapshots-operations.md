# Snapshot Operations

## Current Status

Local collection and browsing work. Cloudflare configuration passes a dry build
and a Miniflare D1 pipeline test. No D1 database, Worker deployment or successful
scheduled production run has been verified.

Personal `/api/scan` queries always use live Sui Mainnet GraphQL. Only
`/api/snapshots/*` uses the global snapshot store. Neither path signs transactions.

## Local Operation

Use Node 22+ from the project directory:

```sh
npm ci
npm run snapshot:collect
npm run snapshot:prices
npm run dev
```

`SNAPSHOT_DIR` defaults to `.snapshots`. Keep this directory private to the server;
it contains SQLite state, manifests, quotes and address pages. A failed run never
updates `latest.json`. Resume an interrupted collecting run with
`npm run snapshot:collect -- --resume`, within its original 40-minute deadline.
After that deadline, start a new run without `--resume`.

The local commands are manual, not scheduled. Local files are retained until an
operator archives/removes them; Cloudflare coordinator retention does not clean
the local directory. Back up the latest manifest, its pages and `state.sqlite`
together if historical evidence must remain usable.

## Data Meaning

- Each global scan pins every chain read to one checkpoint. Expired-checkpoint
  errors fail the job; they do not switch the run to newer chain state.
- Only supported allowlisted distributions are counted, not all Sui airdrops.
- Amounts use integer base units and BigInt aggregation. Holders are deduplicated
  across tokens for the global count, and within each category for its count.
- Unresolved evidence is excluded and explicitly marks the manifest incomplete;
  its verified subtotal is not presented as a complete total. Failed traversal
  or publication retains the prior successful manifest.
- WAL round labels use creation history; unknown rounds remain in the WAL total.
- Administrator recovery availability is a warning, not automatic expiration.
  Existing funds do not guarantee successful redemption; no claim is simulated.
- Quotes use CoinGecko token IDs defined in `snapshots/prices.mjs`. Quotes older than twenty
  minutes or missing quotes produce unavailable USD estimates, not zero values.

## Measured Mainnet Run

Collected November 10, 2026, 10:06:58-10:23:50 Asia/Shanghai, approximately
17 minutes. These are historical checkpoint figures, not current balances.

| Field | Value |
| --- | --- |
| Snapshot | `e60585a5-ce3d-40ed-84b4-2520261df149` |
| Checkpoint | `343560690` |
| Chain time | `2026-11-10T02:06:57.967Z` |
| Distinct holders | 65,415 |
| Allocations | 66,598 |
| Unresolved | 0 |
| WAL | 5,825,550 |
| DEEP | 377,036,319.943587 |
| NS | 2,097,361 |

The local snapshot directory measured approximately 197 MB. This is not a
production storage-cost estimate. D1 write/read usage and Cloudflare runtime
limits have not been measured with a full production population.

## Cloudflare Deployment Gate

Obtain account selection, billing approval and deployment authorization first.
Create the D1 database named `suitokensaver-snapshots`, replace the placeholder
`database_id` in `wrangler.jsonc`, and apply `cloudflare/migrations/0001_snapshot_store.sql`.
Wrangler creates the SQLite Durable Object through its declared migration. Configure
provider credentials as Worker secrets, never frontend variables. Optional quote
authentication is `COINGECKO_API_KEY`.

Before publishing, run:

```sh
npm test
npm run test:cloudflare
npm run test:browser
npm run build
```

After authorized deployment, set the Node server's `SNAPSHOT_API_URL` to the
Worker origin and restart the server. The Worker exposes only snapshot reads;
it does not host the frontend or personal scanner. Same-origin Node proxying
avoids needing a public CORS policy. Never expose coordinator start/step routes.

Cron uses UTC: chain collection `0 2 * * *` (10:00 Asia/Shanghai), quotes every
ten minutes. A run has a 40-minute hard deadline; overlapping schedules reuse an
active run. Jobs are idempotent, with one bounded Durable Object alarm step at a
time for recovery.

Validate the first full cloud run before launch: deadline, latest manifest,
all scope pages, evidence, quote freshness, dead-letter queue, request budget
and storage costs. Miniflare tests are not evidence of production throughput.

## Retention And Failures

The coordinator prunes SQLite jobs, allocations and holder aggregates to the
latest published run plus the active run. D1 prunes old public pages and evidence
only after a new manifest becomes latest. A failed or incomplete run cannot replace
the old public data.

D1 free limits must be monitored: the observed full run has 66,598 allocations,
so a daily rebuild is close to the 100,000 daily-row write allowance before record
and page metadata. If account metrics show a limit breach, disable the schedule and
retain the existing completed snapshot.

Monitor Worker logs, D1 rows read/written, D1 database size and latest checkpoint
age. A snapshot older than seven hours is labeled overdue in the UI. Prices expire
independently. Storage failures never become fake zero totals and do not disable
personal live scanning.

## Verification Coverage

Unit tests cover checkpoint-bound reads, evidence validation, exact aggregation,
duplicate records, cursor cycles, bounded job dispatch, retention and query
validation. Miniflare covers publication of multiple pages, overlap, stale jobs,
old evidence retirement and preserving the latest success after provider failure.
Browser tests cover categories, pagination, mobile overflow, absent snapshots
and independent live verification. Production crash/retry exhaustion, checkpoint
eviction and full cloud throughput remain deployment checks, not verified claims.
