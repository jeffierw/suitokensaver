# Snapshot Operations

## Architecture

- Pages serves the UI and proxies same-origin `/api` requests to the Worker.
- Personal scans always use live Sui GraphQL; snapshots never decide eligibility.
- GitHub Actions runs fixed-checkpoint collection and local SQLite aggregation.
- D1 stores only packed 25-address pages and 1,024 evidence shards.
- No R2, Queue, Durable Object or paid-plan upgrade is required.
- Historical token amounts are not a guarantee of successful redemption.

## Schedule

`.github/workflows/daily-snapshot.yml` targets 02:00 UTC / 10:00 Asia/Shanghai.
GitHub may delay scheduled jobs. The measured local full scan took 17 minutes;
publication occurs after collection and upload, not exactly at 10:00.
Jobs time out after 40 minutes, do not overlap, and upload no Actions artifacts.
The UI shows checkpoint and completion timestamps; after 26 hours it flags overdue.
Prices refresh independently every ten minutes and expire after twenty minutes.

## Publication

`npm run snapshot:collect` builds ignored `.snapshots` locally.
`npm run snapshot:upload` requires `SNAPSHOT_IMPORT_URL` (HTTPS Worker origin) and
`SNAPSHOT_IMPORT_TOKEN`. Store the same generated token in a Worker secret and
a GitHub repository Actions secret. Never commit or expose it in frontend code.

Authenticated imports reserve at most one new run per UTC day. Repeated begin,
upload and publication calls for the same run are idempotent. Conflicting retries
are rejected. Only a complete manifest with zero unresolved records is accepted.
All declared page keys and evidence shards must arrive before the latest pointer
changes atomically. A failed scan/upload leaves the last published snapshot intact.
An interrupted Actions job cannot resume its lost runner files: retry collection
on the next UTC day if that day's import budget has already been reserved.

The latest published run and active staging run are retained. Cleanup removes
retired packed artifacts in bounded batches; open old pages may require refresh.
Legacy partial `snapshot_records` from the failed DO architecture are not read or
deleted during this migration. Migration v2 retires the old DO class and its alarms.

## Free-Tier Bounds

D1 Free currently allows 100,000 written rows/day, 5 million read rows/day and
500 MB per database (5 GB per account). Index and trigger writes also count.
Each snapshot is capped at 12,000 artifacts, 180 MiB total, 512 KiB per artifact.
The normal population is expected to be approximately 6,400 artifacts, not
66,000 per-allocation writes. Monitor measured D1 usage rather than treating this
as an unlimited-service guarantee. Quota exhaustion can stop updates or reads.

Private-repository GitHub Actions minutes share the account's allowance; monitor
account usage and keep paid overage disabled. A daily 17-25 minute job consumes
roughly 510-750 minutes in a 30-day month, excluding other workflows/repositories.
No workflow changes billing settings.

## Deployment

```sh
npm test
npm run test:cloudflare
npm run test:browser
npm run build
npx wrangler d1 migrations apply suitokensaver-snapshots --remote
npx wrangler deploy
npx wrangler pages deploy dist --project-name suitokensaver --branch main
gh workflow run daily-snapshot.yml --repo jeffierw/suitokensaver
```

Verify the actual workflow completes, then check `/api/snapshots/latest`, each
token category, evidence, prices, and a same-origin browser personal query.
Storage errors must remain errors, never zero balances. Do not activate paid
resources to recover quota errors; keep old data with honest timestamps.
