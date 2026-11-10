# Localized Airdrop Overview

## Intent

Keep the read-only Sui scanner useful and understandable: visible airdrop
categories, trustworthy reference valuations, and consistent localized UI.
No wallet connection, transaction building, signing, or submission.

## Approaches

The user selected layout A: overview and categories, personal scanner, then
category address details. Layout B (full address table before the scanner)
was rejected because it pushes personal lookup too far down the page.

## Layout A

1. Compact brand header with language menu and Mainnet indicator.
2. Supported airdrop overview: reference value, holder/allocation counts,
   token categories, and associated distribution rounds.
3. Personal address/SuiNS scanner and results.
4. Below completed personal results, one sponsorship line naming `0xpest.sui`
   with a copy action. No wallet prompt or automatic donation.
5. Snapshot address list controlled by the overview's token/round selection.
   Provide a clear jump-to-list link after selecting a category.
6. Keep explanatory copy concise and outside the primary data controls.

Use a token tab row and a wrapping subordinate round selector, not a pair of
unrelated small selects. Allocation state uses a segmented control. Unknown
WAL remains an explicit category. Personal scans remain live and independent
of historical global snapshots; filtering must not silently omit scan sources.

## Quote Semantics

Production evidence: DefiLlama returned NS null after the upstream timestamp
exceeded the 20-minute limit. The current UI also suppresses the total whenever
any token lacks a quote, and does not refetch quotes on an interval.

Cetus Aggregator skill is installed and read. The documented read-only
`router_v3/find_routes` endpoint successfully returned 100 NS -> 0.895500 USDC
on November 10, 2026. The returned provider was DIPCOIN, not a Cetus pool.
No swap endpoint was called.

Implementation proposal:
- Keep valid DefiLlama quotes and request a Cetus Aggregator reference quote
  per missing token. Check allowlisted exact coin types, integer amounts,
  successful response, input/output routing boundaries and deviation.
- Use a bounded small reference amount. Record source, fetch time, amount,
  output asset and underlying providers. Do not present extrapolated aggregate
  amounts as liquidation proceeds.
- A USDC reference valuation assumes USDC approximately equals USD; disclose
  this when that fallback contributes. Do not imply an independent USD oracle.
- Preserve 20-minute freshness; never relabel old provider data as fresh.
- Display complete estimated value only with complete pricing. Otherwise show
  priced subtotal with missing symbols explicitly listed. Never treat a
  missing quote as zero.
- Refetch quotes periodically and on return to the tab, with cancellation;
  do not refetch or mutate the pinned chain snapshot just to refresh prices.
- Verify Worker-origin access and scheduled D1 writes before declaring fixed.

## Localization And Time

Support English, Simplified Chinese, Traditional Chinese, Japanese, Korean,
French and Ukrainian. Match navigator.languages in preference order; map
Chinese region/script variants appropriately; default to English when none
match. A manual language choice persists locally and overrides auto-detection.

Translate headings, controls, tooltips, validation, loading/empty/error states,
distribution labels, evidence explanations and sponsorship copy. Keep addresses,
object types, brand names and exported raw evidence intact. Unknown upstream
error details may appear as technical details beneath a localized error.

All visible dates and times use UTC with an explicit UTC suffix, irrespective
of locale. The daily collection target is 02:00 UTC; completion may be delayed.

## Interaction Quality

Apply Emil Kowalski skill: stable control dimensions, clear selected/hover/focus
states, keyboard-accessible controls, touch-friendly targets, hover styling only
on hover-capable devices, reduced-motion support and no decorative table-entry
animations. Keep numeric columns aligned and labels wrapping without overlap.
Do not nest decorative cards or make the entire overview a hero-sized card.

## Verification

- Unit tests: quote validation/failure/freshness, partial totals, locale matching,
  translation key completeness and UTC formatting.
- Worker integration tests: mixed-source prices, failures and D1 persistence.
- Browser tests: category filters, live-query independence, sponsorship placement,
  all seven languages, long labels, desktop/mobile widths and quote refresh.
- Production: verify NS, aggregate/reference labels, scheduled price publication,
  Pages deployment and screenshots. Do not claim success based only on local API
  access or a single briefly valid quote.

## Constraints

Retain Pages + Worker + D1 + daily Actions architecture and free-tier bounds.
No paid service, new wallet capability, or changes to claim eligibility logic.
