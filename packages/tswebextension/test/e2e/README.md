# tswebextension e2e (Vitest Browser Mode)

Real-browser tests that exercise the boundary between the cosmetic emitter,
[`@adguard/extended-css`](https://github.com/AdguardTeam/ExtendedCss) and
`CssHitsCounter`.

## Why this exists

Some invariants of the AG-265 design — for example that the `--adguard-hit`
custom property is **non-inheriting** so it is observed only on the matched
host element and not on its descendants — are only meaningful in a real
browser with a real CSS cascade. They cannot be verified in jsdom.

The MV2 ExtCSS code string is also checked in real Gecko. The spec evaluates
the string with `new Function` in a regular page with a stubbed `chrome`, so
it covers Gecko parsing and the resulting DOM changes. It does not cover
`tabs.executeScript` itself or the isolated world.

## Layout

| Path | Purpose |
| --- | --- |
| `*.spec.ts` | Specs for the Chromium browser project. |
| `*.firefox.spec.ts` | Specs for the Firefox browser project. |

The Chromium project is configured in `vitest.config.ts` (project name:
`browser`). It uses `@vitest/browser-playwright` as the provider with
headless Chromium. The Firefox project is configured in
`vitest.firefox.config.ts` and runs only the `*.firefox.spec.ts` specs.

## Running

Run the Chromium specs:

```sh
pnpm --filter @adguard/tswebextension test:e2e
```

Run the Firefox specs:

```sh
pnpm --filter @adguard/tswebextension test:e2e:firefox
```

`pnpm test`, `pnpm test:ci`, and `pnpm test:prod` load only
`vitest.config.ts`, so they stay Chromium-only. The Firefox specs run in the
Docker CI stage.

## Verify canvas protection

The `canvas-native` project compares native behavior with the installed
wrappers in headless Chromium and Firefox, without a consumer extension. It
is part of the default `vitest run`, so both Playwright browsers must be
installed:

```sh
pnpm --filter @adguard/tswebextension exec playwright install chromium firefox
pnpm --filter @adguard/tswebextension exec vitest run --project canvas-native
```

It does not load an extension, so registration, early delivery and
private-window behavior need a manual check on a built extension.
