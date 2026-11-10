# Pages and Worker Full Site Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Publish the full scanner UI on Cloudflare Pages with real-time and snapshot APIs served same-origin through Workers.

**Architecture:** Extract Express route logic into Worker-compatible handlers. The existing snapshot Worker becomes the only API service; a Pages Function service-binds `/api/*` to it and Pages serves Vite `dist/`.

**Tech Stack:** React/Vite, Cloudflare Pages Functions, Workers, Durable Objects, D1, Sui Mainnet GraphQL, Node 22 tests and Playwright.

**Spec:** ../specs/2026-11-10-pages-worker-full-site-design.md

## Global Constraints

- Use GraphQL RPC, not deprecated Sui JSON-RPC.
- Keep all APIs read-only; no wallet/signing/claim writes.
- Preserve request validation, 16 KB bodies, result contracts and generic upstream errors.
- API requests from the Pages URL must remain same-origin.
- Keep D1 snapshot data separate from live eligibility verification.
- Do not add an external Node host, R2 or Queue.

## Review Focus

- A forged cross-origin API request must receive `403` without reaching Sui GraphQL.
- Invalid/over-size JSON must retain the current safe `400`/`413` behavior.
- Pages proxy must not leak Worker service hostname or bypass API headers.
- Live query failure must not become an empty successful scan.
- Static asset fallback must not intercept `/api/*` requests.

### Task 1: Worker-Compatible Live API

**Files:**
- Create: `worker/live-api.mjs`
- Create: `worker/chain.mjs`
- Create: `worker/scanner.mjs`
- Test: `tests/worker/live-api.test.mjs`

**Interfaces:**
- Consumes: `Request`, Worker `env`, existing `shared/` validation/campaign rules.
- Produces: `handleLiveApi(request, env) -> Response` for resolve and scan routes.

- [ ] Write failing route tests for valid address, SuiNS, invalid input, origin rejection and GraphQL failure.
- [ ] Run focused worker test; expect missing module failure.
- [ ] Port chain/scanner logic to injected Worker `fetch`, preserving response shapes.
- [ ] Run focused and unit suites; expect pass.

### Task 2: Unified Worker API

**Files:**
- Modify: `cloudflare/worker.mjs`
- Modify: `wrangler.jsonc`
- Test: `tests/cloudflare/pipeline.test.mjs`

**Interfaces:**
- Consumes: `handleLiveApi` and existing snapshot route adapter.
- Produces: Worker `/api/resolve`, `/api/scan`, `/api/snapshots/*` endpoints.

- [ ] Write failing runtime route tests for live scan and snapshot paths.
- [ ] Run `npm run test:cloudflare`; expect live routes unavailable.
- [ ] Route live API before snapshots, add safe headers/body parsing and maintain scheduled D1 behavior.
- [ ] Run runtime test suite; expect pass.

### Task 3: Pages Frontend Proxy

**Files:**
- Create: `functions/api/[[path]].js`
- Create: `wrangler.pages.jsonc`
- Modify: `vite.config.js`
- Test: `tests/pages-proxy.test.mjs`

**Interfaces:**
- Consumes: `env.SNAPSHOT_API` Worker service binding.
- Produces: same-origin Pages Function proxy preserving method, path, query, body and response headers.

- [ ] Write failing function proxy test for `/api/scan` forwarding and `Cache-Control` preservation.
- [ ] Run focused proxy test; expect missing function failure.
- [ ] Implement Function and Pages Wrangler config with a Worker service binding.
- [ ] Run proxy/unit tests and Vite build; expect pass.

### Task 4: Deploy and Verify

**Files:**
- Modify: `README.md`
- Modify: `docs/snapshots-operations.md`
- Test: `tests/browser/scanner.spec.js`, `tests/browser/snapshots.spec.js`

**Interfaces:**
- Consumes: deployed Pages URL and same-origin API contract.
- Produces: complete public Pages site with deployment documentation.

- [ ] Run unit, Cloudflare, proxy, browser and production build verification.
- [ ] Create/deploy Pages project and bind it to `suitokensaver-snapshots` Worker.
- [ ] Verify public UI, a real address/SuiNS query, snapshot proxy and mobile layout.
- [ ] Record deployed URLs and operational limits; commit and push the final state.
