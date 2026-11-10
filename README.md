# suitokensaver

Read-only Sui Mainnet airdrop scanner for WAL launch/stakers, DEEP initial/Season 1,
and SuiNS NS. No wallet connection, signatures, or transaction submission.

## Run

Use Node.js 22+ and npm:

```sh
npm ci
npm run dev
```

Open http://localhost:4173. Set `PORT` if that port is in use.
For production, run `npm run build` then `npm start`.

```sh
npm test
npm run check:live
npx playwright install chromium
npm run test:browser
```

Live checks use public mainnet samples whose ownership/status can change.
A live failure must be investigated, not replaced with a mock balance.

## Data And Limitations

- Up to 20 addresses or SuiNS names, including `@name`; aliases deduplicate after resolution.
- Five distribution groups, status filters, object evidence, and JSON export.
- Uses the generally available public Sui Mainnet GraphQL service. JSON-RPC is deprecated.
- Credentials for an alternative compatible GraphQL provider stay server-side; see `.env.example`.
- Tatum and Walrus Memory are **not integrated** in this version.
- No matching object is not proof of ineligibility or a prior claim.
- Claimed receipt amounts are historical allocations, not current balances.
- WAL rounds use NFT creation dates, not last transaction dates. Dates outside known windows remain unclassified.
- Unclaimed is an on-chain object check, not transaction simulation or a redemption guarantee.
- Personal scans read live state sequentially, not an atomic snapshot. Recheck before using a claim portal.
- Recovery-cap eligibility is not automatic expiry; remaining funding must be checked.
- Personal results stay in browser memory unless explicitly exported. Global snapshots separately persist public chain records in SQLite and snapshot files/R2.
- This local server binds to loopback. Internet deployment needs a reverse proxy,
  shared rate limits, a production data-provider budget, and a privacy/log-retention policy.

Original design exports from Stitch project **Web3 Airdrop Portal**
(`5510102675825052347`).

## Global Snapshots

The homepage has WAL / DEEP / NS category lists with round/state filters,
25-address pages, exact token totals, object evidence and separate live verification.
Global statistics never determine personal scan results.

```sh
npm run snapshot:collect
npm run snapshot:prices
npm run test:cloudflare
```

Local snapshots live in ignored `.snapshots/`. Cloudflare configuration schedules
chain collection every six hours and prices every ten minutes, using Queues,
a SQLite Durable Object and R2. **Cloud deployment has not been performed.**
See [operations and deployment gate](docs/snapshots-operations.md) for setup,
retention, verification results and remaining production checks.

## Design files

| Screen | Directory | Source |
| --- | --- | --- |
| Favicon & Logo | `design/stitch/01-favicon-logo` | `logo.svg` |
| Sui Unclaimed Scanner | `design/stitch/02-unclaimed-scanner` | `index.html` |
| Unclaimed Sui Vault | `design/stitch/03-unclaimed-vault` | `index.html` |
| Sui Move Claim Spec | `design/stitch/04-move-claim-spec` | `index.html` |
| AI Signer & Skill Prompt | `design/stitch/05-ai-signer-skill-prompt` | `index.html` |

Each directory includes `screenshot.png` and original `screen.json`
metadata. Project metadata is in `design/stitch/project.json`.
These files are reference exports; the working application lives in `src/` and `server/`.
HTML exports may require internet access for external fonts and libraries.

## Stitch MCP

Project-local Codex configuration: `.codex/config.toml`.
This contains a private API key, is excluded from Git, and must not be shared.
Open this directory as a trusted Codex project to load project-local MCP
configuration; an existing session may need to be reopened.

The exporter reads the key from this configuration without embedding it
in the script. With Node.js 20+ and curl installed, refresh the exports:

```sh
node scripts/download-stitch.mjs
```

Refreshing replaces the exported files. Keep application changes separate
from the original designs.
