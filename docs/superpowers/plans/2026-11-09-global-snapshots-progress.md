# Progress: 2026-11-09-global-snapshots.md

- User approved inline execution.
- Existing directory has no Git repository; work in place, no commits/worktree.
- Shared interfaces: collector yields exact verified records; aggregator consumes
  those records; coordinator persists idempotently; snapshot API never feeds
  personal eligibility queries.
- Tasks 1-5 implemented: checkpoint collector, exact SQLite aggregation,
  Cloudflare pipeline, snapshot/quote API and category explorer.
- Task 6: full local mainnet traversal complete at checkpoint 343560690;
  65,415 holders, 66,598 allocations, zero unresolved records, about 17 minutes.
- Final review fixes: bounded SQL dispatch/pending checks and coordinator
  retention. Missing-method tests reproduced RED, then passed GREEN.
- Retention keeps latest plus active SQLite runs; old R2 pages remain but
  expanded evidence expires. R2 lifecycle and full cloud throughput require
  production setup; no remote resources were provisioned.
- Operations guide added at `../../snapshots-operations.md`.
- Deployment remains gated on Cloudflare account, costs and authorization.
- Final verification: 35/35 unit tests, 7/7 browser tests, Miniflare pipeline,
  Wrangler dry build and Vite production build passed. Node SQLite remains
  experimental and emits its standard runtime warning.
- Live SuiNS resolution and three mainnet sample scans passed. All token-wide
  address pages reconciled to manifest amounts and the 65,415-address union.
- Desktop/mobile real-data screenshots inspected; 390px viewport has no
  horizontal overflow and shows 25 rows per page. Local preview runs on 4173.
