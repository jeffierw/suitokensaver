# Mainnet verification, 2026-11-09

All operations in this milestone are reads. Public GraphQL endpoint:
https://graphql.mainnet.sui.io/graphql.

## DEEP Season 1

- Package: `0x7c28438735d3314fe1c48ce74e3131eb2025fa21694bd1c58b0fd12753974c2f`
- Configuration: `0xa1a4a2e42663a5b7b74e94da4e24bb4c8467343b051ab7509b25f6200481aee5`
- Unlock timestamp: `1780414500000` (2026-06-02 15:35 UTC).
- Recovery timestamp: `1811950500000` (2027-06-02 15:35 UTC).
- NFT `0x9b26254572200c4b5e49d7d31472ac172664828f8d0ee46c9d4884d674dc6f2f`
  records `allocation_withdrawn: false`, allocation `198165393`.
- Its matching shared funding object is
  `0x0002e8684a0e58cadb9aec073542fc448de5b61af0524f6ff230d4edfab0332e`.
- Scanner verified 198.165393 DEEP remains unclaimed on November 9.
- Earlier bytecode investigation found withdrawal gated by enable/unlock, not the
  FAQ's 30-day portal window. Administrator recovery is a separate operation.
- A successful post-window transaction from that investigation:
  `FQwB8Dt6VvRwoPXGkDh98SBSpd5YmfbYdZ` (2026-10-04).
- FAQ: https://www.sui.io/blog/deepbook-season-1-claims-faq.

## WAL Round Classification

Launch NFT `0xdf9ef23672fc82c4cad30e028c1f79caf217ea15a6900e660854dfd0ae61a384`
has first-version transaction `zKu3d1qc3QRqcV4sbtqEPWsNNgpygkuCNv7mTNfqBtK`,
timestamp 2025-02-19 03:26:46 UTC. This predates the March token launch.
Distribution reporting corroborates February 19:
https://www.chaincatcher.com/en/article/2168364.

Staker NFT `0x0ee8d8de7e6d10a59fbe7b922d2598938f3aaada770358f16e2a5f67b76227d5`
has first-version transaction `FHPE3EpngfWgtcu1QVdtpc8QtfNCUVRSzjP3VUrMPfab`,
timestamp 2025-08-21 16:31:10 UTC.

The round label is a creation-date heuristic for allowlisted official NFTs, not
a round field encoded in the NFT. The current windows are February 19 through
March 31 and August 1 through August 31, 2025. Other dates remain unclassified.
Historical retention/availability is provider-dependent.

Additional live sample:
`0x001b393473e362327b784c7daac94be0ef535bc899ce6dcd1b553c27af8a2c7a`
was created on 2025-04-17 by `GGs16J6vJu93kx2rd8Ap3ZSWEHokKFLG47BmWMnstE55`.
Its matching funding object still contains 68 WAL despite recovery being
available since March 2026. It is deliberately shown as WAL unclassified:
this date is outside the confirmed windows. Further issuer/distribution
transaction research is needed before assigning it to a named round.

## DEEP Initial And NS

Unclaimed allocations are funded wrapper objects; claimed allocations are
receipt objects. Do not infer either from current token balances.

Mainnet samples discovered by exact wrapper-type queries:

- DEEP wrapper: `0x00031ae13b6356a96ae0c9a90c6c0f67c1f4c7c8812f10f9b5d46270237c1203`,
  balance `1180000000`, or 1,180 DEEP.
- NS wrapper: `0x000a41999a9fa62d12cf4e6b51a4cf3445326fa2d722934f8f3df140e0a58944`,
  balance `398000000`, or 398 NS.

`scripts/check-live.mjs` rechecks the sample owners and all five adapters.
These are mutable live samples, not permanent fixtures.

## UX Reference

Reviewed https://github.com/emilkowalski/skills, including `ui-cheatsheet.md`
and `skills/emil-design-eng/SKILL.md`. Applied absolute dates, tabular numbers,
specific transition properties, short press feedback, reduced-motion support,
stable controls, and mobile overflow checks. No decorative entrance animations.
