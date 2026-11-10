# Sui Token Saver

## Sui Development Skills

Install community-maintained skills for Sui development:

```sh
npx skills https://github.com/MystenLabs/skills
```

## Sui SDK Reference

Read `node_modules/@mysten/*/docs/llms-index.md` and the relevant package docs.
Use GraphQL or gRPC for new code, not deprecated JSON-RPC.

## Official Resources

- https://docs.sui.io/llms.txt
- https://move-book.com/llms.txt
- https://github.com/MystenLabs/sui/tree/main/examples/move
- Use https://sui.mcp.kapa.ai when available to verify Sui APIs.

## Rules

- Read-only scanner: never sign or broadcast transactions.
- Exact allowlisted object types; no NFT-name-based eligibility.
- Unknown and failed reads are not zero allocations.
- Keep credentials out of frontend bundles and version control.
- Preserve design/stitch as reference exports.
