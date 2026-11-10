# Global Airdrop Snapshots

Status: design approved by the user on 2026-11-09. Feasibility probes complete;
implementation and deployment have not started.

## Confirmed Requirements

- Compute global unclaimed allocations from official contracts and NFT/funding objects.
- Refresh chain statistics every six hours and store snapshots on Cloudflare.
- Clicking a category opens an address-and-amount list, not only a summary.
- Personal address queries continue to read chain state, never snapshot eligibility.

## Approaches

1. Summary-only category views: smallest data payload, but does not meet the
   user's selected address-list experience.
2. Paginated address lists with expandable object evidence: recommended and
   consistent with the user's choice; additional snapshot aggregation/storage.
3. Full historical claims explorer: supports lifetime issuance and claim rates
   but requires historical ingestion; excluded from this milestone.

## Proposed Interface

Keep the introduction and personal scanner. Add a global statistics section below.
Show approximate unlocked/unclaimed USD value, deduplicated holder addresses,
and allocation-object count, with coverage and chain/price timestamps.
Avoid saying "all Sui airdrops": coverage is the explicit supported distribution set.

Token tabs: WAL, DEEP, NS. Clicking selects that token and shows its address list.
Default token: WAL. An "all rounds" selector plus known rounds filters the list;
WAL includes an unclassified round. List state is independent of personal queries.

Each row groups one address within the selected token/round scope:

- Address with copy and explorer link.
- Exact token amount, using integer base units for aggregation.
- Approximate USD value when a valid price is available.
- Number of allocations and the relevant distribution names.
- Status/risk indicator and an explicit live-check action.

Default sort is token amount descending; address ascending breaks ties.
Proposed page size: 25. Stable pagination is pinned to snapshot ID; refreshing
to a new snapshot resets pagination. Mobile rows prioritize address and amount.
Expandable details show NFT/wrapper IDs, funded amounts, round, and risk flags.
Live check calls the existing scanner and presents its new timestamps separately;
it never silently rewrites a row from an older global snapshot.

## Counting And Valuation

Only positive, verified funded allocations qualify. Default totals/list cover
unlocked allocations. Locked allocations have a separate selectable status
and separate amounts. Unverifiable records are excluded from verified value,
counted as unresolved, and cannot be represented as zero or claimed.

Recovery availability is a warning, not automatic expiry. An unlocked funded
allocation may be counted while recovery is available, with its exposed amount
and risk disclosed. A receipt alone contributes no unclaimed amount.

Deduplicate by object ID before aggregation. Deduplicate addresses independently
for each selected scope and for the global distinct-address total; do not sum
token-level holder counts to get the global holder count.

Creation-date WAL round labels remain heuristics. Unknown round does not mean
unknown token: verified official funded WAL can contribute to the token total.
Do not claim lifetime NFT issuance, total claimed, or claim percentage from
current object enumeration. Ownership and live object count are mutable.

Prices use exact verified token identities and a named provider, to be selected
after checking coverage, limits, and available credentials. Proposed cadence:
10 minutes, separate from six-hour chain snapshots. Store source, quote timestamp,
and freshness. Missing/stale quotes show unavailable estimates, never zero;
partial valuation must not be titled as a complete total.

## Proposed Cloudflare Pipeline

Workers Cron triggers a scheduled run; Queues execute bounded paginated work;
R2 stores versioned chunks, per-token/per-round pre-sorted list pages, summaries,
and manifests. Avoid downloading all addresses for a page view.

Implementation must choose a durable run coordinator after validating scale.
It must support idempotent work, retries, one active run, completion accounting,
and atomic publication of the latest successful manifest. No secrets in the UI.
Do not assume Queue delivery order or exactly-once delivery.

A failed traversal does not replace the last successful snapshot. Distinguish
successful complete traversal from unresolved individual object evidence:
the latter exposes incomplete verification and a verified subtotal, not a total.
Use per-token manifests so coverage/failure is explicit.

Prefer checkpoint-consistent enumeration and validation if the chosen provider
supports it. Otherwise publish scan start/end times and an explicit scan-window
qualification, not a fabricated single-checkpoint snapshot. Investigate object
changes during traversal before promising exact whole-network totals.

CF account permissions, bindings, production RPC budget, object volume, rate
limits, execution time, retention, and price access require a feasibility check
before production deployment. Never silently fall back to publishing sample totals.

Feasibility update: fixed-checkpoint enumeration and multi-get were verified.
The public endpoint currently exposes approximately one hour of object-set
retention. Use a checkpoint-bound run with a forty-minute initial deadline,
and fail closed rather than mixing checkpoints if it cannot complete.
Enumerate live Locked funding objects for WAL/DEEP S1 and validate referenced
NFTs, instead of enumerating every historical claim receipt. Use a SQLite-backed
Durable Object as the proposed durable coordinator. See the research probe and
implementation plan for measured lower bounds and remaining production gates.

## Boundaries And Verification

No signing, claim submission, private keys, inferred wallet identity, fake stats,
or Tatum/Walrus Memory integration claims.

Test double deliveries, partial pages, cursor failures, failed runs, publication,
amount precision, holder deduplication, missing prices, round filtering,
snapshot-pinned paging, and live-check independence. Compare sampled snapshot
rows with chain evidence; test desktop/mobile and a large synthetic test dataset.
Synthetic data is for tests only, never the public statistics view.
