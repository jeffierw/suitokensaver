# Snapshot Feasibility Probe

Read-only probes executed on 2026-11-09 (Asia/Shanghai).
Endpoint: https://graphql.mainnet.sui.io/graphql.
No resources were provisioned and no production snapshot was published.

## Consistent Reads

Live schema exposes `checkpoint(sequenceNumber: UInt53).query`, described as
querying the RPC as if that checkpoint were latest. Executed ten sequential
object pages for each source at checkpoint 343345496, then fetched NFT references
using `checkpoint.query.multiGetObjects`. Both work.

Service limits observed:

- Query.objects page size: 50.
- multiGetObjects maximum keys: 200.
- Server query timeout: 40,000 ms (existing application timeout is 18,000 ms).
- ObjectConnection has no total-count field.

Object-query available range observed:

- First: checkpoint 343330946, 2026-11-09T10:39:14.560Z.
- Last: checkpoint 343345942, 2026-11-09T11:39:48.496Z.

This is a moving range of approximately one hour, NOT a contractual retention
guarantee. Check availableRange per run. A six-hour trigger interval does not
mean a run can spend six hours reading its checkpoint. Use a 40-minute hard run
deadline initially, recheck retention before subsequent pages, fail closed if
the checkpoint falls out of range, and retain the last successful manifest.
Longer runs require a provider with suitable retention/performance.

## Bounded Volume Probe

Ten 50-object pages were read per source. All still had a next page:

| Source enumerated | Observed lower bound | Enumeration time |
| --- | ---: | ---: |
| WAL Locked | 500 | 4.353 s |
| DEEP Season 1 Locked | 500 | 3.469 s |
| DEEP initial DEEPWrapper | 500 | 2.937 s |
| NS NSWrapper | 500 | 2.456 s |

These are lower bounds, NOT total supplies or statistically random samples.
Timing excludes NFT joins, WAL creation history, aggregation, retries and
Cloudflare storage. No full-run cost or completion-time claim is justified yet.

For the first 50 Locked objects of each locked source, all held positive
balances. For the first 50 WAL NFTs, none were unwithdrawn. Enumerating Locked
objects first avoids spending most reads on historical claimed receipts.
Every candidate still requires exact type checks, NFT/funding bidirectional
binding, owner validation, withdrawal flag and configuration checks.

Confirmed WAL pair:

- Locked: 0x000052cf3e258662d61f5a1b2efb222f1f6eba84f843c241bb54f3dac9a6e81e
- NFT: 0xcfd5430352ea238d420575f7b41a76f820083c3a1b7a176fc5d3f6fa96de9a14
- Balance: 981000000000 base units; allocation_withdrawn: false.

## Cloudflare Readiness

No wrangler binary was on PATH. No configuration directory was found at
~/.wrangler, ~/.config/.wrangler, or ~/Library/Preferences/.wrangler.
No CLOUDFLARE*, CF_*, or WRANGLER* environment variable names were present.
This establishes only that no local credentials were found in standard places;
it does not establish that the user lacks a Cloudflare account.

Cloud account, resource bindings, service entitlements and budget are unverified.
Local implementation/testing can proceed independently; remote provisioning and
deployment require authenticated account selection and explicit authorization.

Documentation consulted:

- https://developers.cloudflare.com/queues/platform/limits/
- https://developers.cloudflare.com/durable-objects/platform/limits/
- https://developers.cloudflare.com/r2/pricing/

Proposed coordinator: SQLite-backed Durable Object, using durable per-run/page
state and exact integer aggregation. Workers Cron/Queues handle bounded work;
R2 serves immutable, pre-paginated public snapshot artifacts.
