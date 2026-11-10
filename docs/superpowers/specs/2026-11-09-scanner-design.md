# Sui Token Saver Scanner

## Scope

Implement the discussed read-only scanner: WAL launch and staking distributions,
DEEP initial distribution and Season 1, and SuiNS NS distribution.
Support up to 20 unique Sui addresses or SuiNS names per batch, including @name
and name.sui, with validation and deduplication after name resolution.
No wallet connection, signatures, transaction broadcast, or mock balances.

## Approach

Use a React/Vite frontend and a small Node/Express read-only API.
Use official Sui SDK utilities and mainnet GraphQL (JSON-RPC is deprecated).
No database or custom indexer. Read pagination to exhaustion or report incomplete.
Do not equate absence of an NFT with already claimed or ineligible.
Use exact allowlisted Move types and validate associated objects and balances.
WAL rounds share a type: classify from first on-chain object version's creation
transaction. Unknown creation history remains an unclassified WAL distribution.
A recovery timestamp is not an automatic claim expiry.

## User Experience

Retain Stitch's dark neutral surfaces, mint accent, and local logo.
Replace decorative hero, fabricated global statistics, dummy results, and inactive
navigation with a compact query form and results grouped by distribution.
Show account, exact token amount, status, object evidence, timestamps, and source.
Offer status filters, expandable evidence, copy controls, and result export.
No dollar totals without a verified price provider.
Inputs and results support mobile and keyboard interaction; no disabled zoom.

## Boundaries

Chain-based eligibility is not a guarantee that a wallet transaction will succeed.
Official portal availability is distinct from chain state.
No unverified auto-generated external claim links.
Tatum and Walrus Memory are not integrated in this milestone without credentials
and a separate memory-consent design. Never represent the public endpoint as Tatum.
Preserve original Stitch exports except repair local logo references.

## Verification

Live read-only smoke checks on all adapters; deterministic validation tests;
desktop/mobile browser checks, including long addresses, empty/error states,
partial batch results, repeated submissions and logo rendering.
