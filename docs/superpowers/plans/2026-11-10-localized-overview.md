# Localized Overview Execution

Approved design: ../specs/2026-11-10-localized-overview-design.md.
User explicitly requested implementation. Work in the current shared repository;
do not discard existing changes.

1. Price provider: add regression tests for missing/stale NS, exact Cetus
   coin types, route validation and independent provider failures. Implement
   bounded reference quotes in snapshots/prices.mjs with metadata.
2. Localization: add shared locale detection, UTC formatter, React context and
   seven complete dictionaries. Test Chinese scripts and fallback behavior.
3. UI: split SnapshotExplorer overview from details using a scanner content slot.
   Add token/round/state controls and honest partial valuations. Translate all
   application text, add language menu and sponsorship below personal results.
4. Quality: test quote refresh, filters, locale switching, UTC, result sponsorship,
   responsive overflow and live query independence. Inspect screenshots.
5. Verify unit, Cloudflare and browser suites. Build, commit, push, deploy Worker
   and Pages production. Observe scheduled quotes and verify public UI.

Price-provider work and localization infrastructure are independent and may be
delegated in disjoint files. Integration and deployment remain with the parent.
