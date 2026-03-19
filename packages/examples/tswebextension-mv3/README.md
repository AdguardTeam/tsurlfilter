# TSWebExtension — Manifest V3 Sample Extension

A sample browser extension demonstrating how to use
[`@adguard/tswebextension`](../../tswebextension/README.md) in a Manifest V3
extension. It shows request filtering, cosmetic rule injection, and
declarative rule precompilation.

## Building

```shell
pnpm build
```

The built extension is output to `build/` and can be loaded as an unpacked
extension in Chromium.

### Precompile declarative rules

Convert filter rules to DNR format before loading the extension:

```shell
pnpm build:precompile-rules
```

## Demo

1. After installing, filtering is enabled automatically. Visit
   <https://canyoublockit.com/testing/> — the site will be blocked.
2. Toggle filters in the popup. For example, disable "Filter 2" and revisit
   the test page — it will open.
3. Add custom user rules (e.g. `||example.org$document`), click "Apply", then
   visit <https://example.org> — the site will be blocked.
4. Cosmetic rules currently apply with ~2 s latency.
5. To inspect applied declarative rules, open the service worker console from
   `chrome://extensions`.

## Documentation

- [Examples overview](../AGENTS.md)
- [Development guide](../../../DEVELOPMENT.md)
