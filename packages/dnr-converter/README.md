<!-- omit in toc -->
# DNR Converter

[![npm-badge]][npm-url] [![license-badge]][license-url]

[npm-badge]: https://img.shields.io/npm/v/@adguard/dnr-converter
[npm-url]: https://www.npmjs.com/package/@adguard/dnr-converter
[license-badge]: https://img.shields.io/npm/l/@adguard/dnr-converter
[license-url]: https://github.com/AdguardTeam/dnr-converter/blob/master/packages/dnr-converter/LICENSE

A TypeScript library that converts adblock-style filtering rules into rules
compatible with Chrome's
[Declarative Net Request (DNR)][dnr-api-url] API. It is designed for developers
building Manifest V3 browser extensions that need to translate existing AdGuard
or other adblock filter lists into the DNR format required by modern Chrome
extensions.

[dnr-api-url]: https://developer.chrome.com/docs/extensions/reference/api/declarativeNetRequest

- [Key concepts](#key-concepts)
    - [Supported rule types](#supported-rule-types)
- [Installation](#installation)
    - [Peer dependencies](#peer-dependencies)
- [API overview](#api-overview)
    - [`DNR_CONVERTER_VERSION`](#dnr_converter_version)
    - [`isSafeRule(rule)`](#issaferulerule)
    - [`ConverterOptions`](#converteroptions)
    - [`Filter`](#filter)
- [Documentation](#documentation)

## Key concepts

- **Filter** — an adblock filter list represented as an object with an `id` and
  text `content`. Each filter list (e.g. AdGuard Base, EasyList) becomes one
  `Filter` input.
- **Declarative rule** — a
  [`chrome.declarativeNetRequest.Rule`][dnr-rule-url] object that the browser
  evaluates natively. The converter produces these from filter text.
- **Source map** — a mapping from each generated declarative rule back to its
  originating filter and rule index, enabling reverse lookup when a declarative
  rule fires.
- **Rule safety** — Chrome
  [classifies DNR rules][dnr-safe-rules-url] as *safe* (block, allow,
  allowAllRequests, upgradeScheme) or *unsafe* (redirect, modifyHeaders). The
  library exposes a helper to check safety.
- **Converter options** — limits and paths that control conversion output
  (maximum rule counts, resource paths for redirects).

[dnr-rule-url]: https://developer.chrome.com/docs/extensions/reference/api/declarativeNetRequest#type-Rule
[dnr-safe-rules-url]: https://developer.chrome.com/docs/extensions/reference/api/declarativeNetRequest#safe_rules

### Supported rule types

<!-- TODO: This section should be updated once the full extraction of the DNR
converter from `@adguard/tsurlfilter` is complete. The `RegularConverter` class
is currently a thin stub; the full modifier support will mirror what is described
in the tsurlfilter declarative-converter readme.txt once extracted. -->

The converter is being extracted from the `tsurlfilter` package and aims to
support virtually all adblock network rule modifiers. The known MV3 limitations
(inherent to the Declarative Net Request API) are:

**Supported modifiers** (with MV3 notes):
- Basic blocking/allowing rules, `$third-party`, `$domain` (no regexps / `.*`
  TLDs), all content types (`$script`, `$image`, `$stylesheet`, etc.)
- `$important`, `$match-case`, `$method`, `$to`, `$denyallow`, `$header`
  (no regex values), `$all`
- `$redirect` — allowlist rules not supported
- `$csp`, `$removeparam`, `$removeheader`, `$permissions` — allowlist rules
  not supported; rules with identical conditions are combined only within the
  same filter, not across filters
- `$badfilter` — partial: does not handle `$domain` intersections correctly
  (see [MV3 limitations][mv3-limitations-url])

**Not yet supported / not convertible to DNR**:
- `$popup`, `$redirect-rule`, `$referrerpolicy` — not yet implemented
- `$replace`, `$jsonprune`, `$hls`, `$network`, DNS modifiers (`$client`,
  `$dnsrewrite`, `$dnstype`, `$ctag`) — not expressible in DNR; produce
  conversion errors and are skipped
- Exception modifiers `$jsinject`, `$stealth`, `$urlblock`, `$genericblock` —
  not yet implemented
- `$webrtc` — deprecated and not supported

[mv3-limitations-url]: https://github.com/AdguardTeam/tsurlfilter/blob/master/packages/tsurlfilter/src/rules/declarative-converter/readme.txt

## Installation

```bash
# pnpm
pnpm install @adguard/dnr-converter

# yarn
yarn add @adguard/dnr-converter

# npm
npm install @adguard/dnr-converter
```

### Peer dependencies

The package requires [`@adguard/re2-wasm`](https://www.npmjs.com/package/@adguard/re2-wasm)
(`1.2.0`) as a peer dependency for regex validation.

## API overview

### `DNR_CONVERTER_VERSION`

```ts
import { DNR_CONVERTER_VERSION } from '@adguard/dnr-converter';

console.log(DNR_CONVERTER_VERSION); // e.g. "0.0.1"
```

A string constant with the current library version.

### `isSafeRule(rule)`

```ts
import { isSafeRule } from '@adguard/dnr-converter';

// DeclarativeRule from the DNR API
const rule = {
    id: 2,
    priority: 1,
    action: { type: 'block' },
    condition: { urlFilter: 'example.com' },
};

isSafeRule(rule); // true — "block" is a safe action
```

Returns `true` if the declarative rule's action is one of the
[safe rule actions][dnr-safe-rules-url] (`block`, `allow`,
`allowAllRequests`, `upgradeScheme`). Useful for separating safe static rules
from unsafe dynamic rules that require additional review.

### `ConverterOptions`

```ts
import type { ConverterOptions } from '@adguard/dnr-converter';
```

Configuration for the conversion process:

| Property | Type | Description |
| --- | --- | --- |
| `resourcesPath` | `string?` | Path to web-accessible resources relative to the extension root (starts with `/`, no trailing `/`). Required for `$redirect` rules. |
| `maxNumberOfRules` | `number?` | Maximum total declarative rules to produce. Excess rules are trimmed. |
| `maxNumberOfUnsafeRules` | `number?` | Maximum unsafe (dynamic) rules allowed. |
| `maxNumberOfRegexpRules` | `number?` | Maximum rules using `regexFilter`. |

### `Filter`

```ts
import type { Filter } from '@adguard/dnr-converter';
```

Represents an input filter list:

| Property | Type | Description |
| --- | --- | --- |
| `id` | `number` | Unique filter identifier |
| `content` | `string` | Full text of the filter list (one rule per line) |

## Documentation

- [Changelog](CHANGELOG.md)
- [Development](DEVELOPMENT.md)
- [LLM agent rules](AGENTS.md)
