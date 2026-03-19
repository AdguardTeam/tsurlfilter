# TSWebExtension — Manifest V2 Sample Extension

A sample browser extension demonstrating how to use
[`@adguard/tswebextension`](../../tswebextension/README.md) in a Manifest V2
extension. It shows request filtering via the blocking webRequest API,
cosmetic rule injection, and scriptlet execution.

## Building

```shell
pnpm build
```

The built extension is output to `build/` and can be loaded as an unpacked
extension in Chromium or Firefox.

## Testing

Run browser tests (requires a built extension):

```shell
pnpm test
```

## Documentation

- [Examples overview](../AGENTS.md)
- [Development guide](../../../DEVELOPMENT.md)
