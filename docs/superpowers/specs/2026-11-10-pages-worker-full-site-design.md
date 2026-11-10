# Pages and Worker Full Site Design

## Intent

Publish the complete Sui Token Saver product on Cloudflare under a Pages URL.
The static React frontend must retain every existing function: direct Sui address
and SuiNS batch input, live read-only scans, WAL/DEEP/NS category results and
the D1-backed global snapshot explorer. Users must not be sent to a separate
API hostname or see broken relative `/api/*` calls.

## Goals

- Build and deploy the Vite frontend with Cloudflare Pages.
- Move Express API routes into a Cloudflare Worker API service:
  `/api/resolve`, `/api/scan`, and `/api/snapshots/*`.
- Route Pages `/api/*` requests to the existing `suitokensaver-snapshots`
  Worker using a service binding, keeping browser requests same-origin.
- Preserve read-only GraphQL behavior, validation, response shapes, security
  headers, input limits and rate-limit semantics where compatible with Workers.
- Use the existing D1/DO snapshot Worker, without adding R2, Queue, wallet
  connection, transaction signing or an external Node host.

## Non-Goals

- Deploy or maintain the Express server as a public Node process.
- Migrate the local CLI collector; it remains a developer/operations utility.
- Add user accounts, persistence of personal scans, analytics, or claim writes.
- Guarantee zero Cloudflare cost. Pages is static, but Worker/D1 execution and
  GraphQL provider usage must still be observed against account limits.

## Architecture

`src/` builds to `dist/` and Cloudflare Pages serves it. A Pages Function at
`functions/api/[[path]].js` forwards same-origin `/api/*` requests to the
snapshot Worker through `env.SNAPSHOT_API.fetch(request)`. The snapshot Worker
becomes the sole API origin: it handles live Sui GraphQL resolution/scanning,
snapshot reads, D1 quotes and scheduled snapshot collection.

The Node-specific modules are split into pure request/response route handlers
and runtime adapters. GraphQL calls use the Workers global `fetch`; the worker
holds optional provider credentials in Worker secrets. A Durable Object
coordinates public snapshot collection. A Durable Object-backed per-IP limiter
replaces Express's process-local map so requests are limited consistently across
Worker isolates.

## Approaches Considered

1. **Pages plus external Node server:** smallest code change, but creates a
   second host, CORS policy, operations and likely paid service. Rejected.
2. **Pages plus existing Worker API, selected:** one public frontend host and
   one Worker service, same-origin API routes, no separate Node deployment.
3. **Static Pages only:** easiest deployment but breaks the product's central
   real-time address scans. Rejected.

## Security and Data Rules

- Requests remain read-only. Never request wallet access, keys or signatures.
- Validate origin for non-GET APIs when an Origin header is present.
- Preserve the 16 KB JSON body cap and 20-address batch cap.
- Return generic upstream failure responses; never expose provider keys.
- Use GraphQL RPC, not deprecated Sui JSON-RPC.
- Snapshot data remains separate from live eligibility verification.

## Deployment

- Create a Pages project named `suitokensaver`, build command `npm run build`,
  output directory `dist`.
- Bind Pages Function `SNAPSHOT_API` to the existing Worker as a service binding.
- Configure Worker secrets only when a private GraphQL provider is used.
- Deploy through Wrangler, then verify Pages UI, live address/SuiNS query,
  snapshot API proxy and mobile layout at the Pages URL.

## Acceptance Criteria

- The Pages URL renders the React UI and its `/api/scan` response matches the
  local Express response contract for a real mainnet address.
- The Pages `/api/snapshots/latest` proxy reaches the deployed Worker.
- Invalid input returns the existing client-safe 400 response.
- Same-origin response headers include `Cache-Control: no-store` and
  `X-Content-Type-Options: nosniff` for API responses.
- Browser and Worker tests pass; public verification does not use mock
  allocations or fake global totals.
