# AdGuard API MV3 — Sample Extension

A sample Manifest V3 browser extension demonstrating how to use
[`@adguard/api-mv3`](../../adguard-api-mv3/README.md) together with
[`@adguard/dnr-rulesets`](../../dnr-rulesets/README.md) to add content
blocking to an MV3 extension. It shows filter list configuration, DNR ruleset
loading, and the AdGuard Assistant UI.

## Building

```shell
pnpm build
```

The built extension is output to `build/` and can be loaded as an unpacked
extension in Chromium.

## Documentation

- [Examples overview](../AGENTS.md)
- [Development guide](../../../DEVELOPMENT.md)
