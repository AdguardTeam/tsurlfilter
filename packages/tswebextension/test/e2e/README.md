# tswebextension e2e (Vitest Browser Mode)

Real-Chromium tests that exercise the boundary between the cosmetic emitter,
[`@adguard/extended-css`](https://github.com/AdguardTeam/ExtendedCss) and
`CssHitsCounter`.

## Why this exists

Some invariants of the AG-265 design — for example that the `--adguard-hit`
custom property is **non-inheriting** so it is observed only on the matched
host element and not on its descendants — are only meaningful in a real
browser with a real CSS cascade. They cannot be verified in jsdom.

## Layout

| Path | Purpose |
| --- | --- |
| `*.spec.ts` | Individual specs using Vitest + direct DOM access in a real Chromium browser. |

The browser project is configured in the root `vitest.config.ts` (project
name: `browser`). It uses `@vitest/browser-playwright` as the provider with
headless Chromium.

## Running

```sh
pnpm --filter @adguard/tswebextension test:e2e
```

## Verify canvas protection

The `canvas-native` project compares native behavior with the installed
wrappers in headless Chromium and Firefox, without a consumer extension:

```sh
pnpm --filter @adguard/tswebextension exec vitest run --project canvas-native
```

It does not load an extension, so registration, early delivery and
private-window behavior need a manual check on a built extension.
