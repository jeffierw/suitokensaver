# Actions Free Snapshots

Approved execution: user requested implementation through completion.

## Decisions

- Collect once daily in a private-repository Linux Actions job, timeout 40 minutes,
  schedule 02:00 UTC, no artifact/cache uploads or paid runner.
- Keep local fixed-checkpoint SQLite aggregation; never put intermediate jobs or
  per-allocation writes in Cloudflare. Remove the Durable Object and its alarm.
- D1 stores precomputed 25-holder pages and 1,024 address-sharded evidence blocks.
  Cap at 12,000 artifacts and 180 MiB per run; two runs fit the 500 MB free per-DB
  limit excluding old migration data. Bound each block to 512 KiB.
- Authenticated importer allows one new run per UTC day, repeat uploads are
  idempotent. One active staging run; publish pointer atomically only after all
  declared artifacts arrived. No SQL access or arbitrary external URLs in import.
- Public queries use D1 directly, including latest/evidence/quotes. No DDL on reads.
- Keep latest plus staging. Clean retired packed data in bounded chunks; leave
  legacy partial tables untouched initially to avoid spending today's write budget.
- Pages proxy must validate browser Origin before forwarding; currently it
  forwards a Pages Origin to a different Worker host, which rejects real browsers.
- No paid-plan upgrade, visibility change or budget change. Free quotas can deny
  service; do not claim unlimited free operation. Private Actions minutes shared
  with other repositories require account monitoring.

## Execution

- [ ] Add packed export/import tests: incomplete upload, duplicate delivery,
  conflicting data, day budget, exact amounts, stale publication, retained latest.
- [ ] Implement runner export/upload and D1 import protocol; remove DO/chain Cron.
- [ ] Fix same-origin Pages forwarding and daily freshness indication with tests.
- [ ] Run all suites, review, deploy migrations/Worker/Pages, configure secrets.
- [ ] Push/dispatch actual Actions run; wait for success and verify live UI,
  category pages, evidence and live address queries, then record costs/results.
