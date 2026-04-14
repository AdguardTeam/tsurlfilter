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
    - [`IFilter` / `IFilterWithSource`](#ifilter--ifiltersource)
    - [`ConverterOptions`](#converteroptions)
    - [Simple flow: `FilterConverter` + `Ruleset`](#simple-flow-filterconverter--ruleset)
    - [Advanced flow: `FilterConverterWithSourceMap` + `RulesetWithSourceMap`](#advanced-flow-filterconverterwithsourcemap--rulesetwithsourcemap)
    - [`ConversionResult`](#conversionresult)
    - [`IRuleSet` / `RuleSet`](#iruleset--ruleset)
    - [`MetadataRuleSet`](#metadataruleset)
    - [`isSafeRule(rule)`](#issaferulerule)
    - [`DNR_CONVERTER_VERSION`](#dnr_converter_version)
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

The library exposes **two conversion flows**:

| | Simple flow | Advanced flow |
| --- | --- | --- |
| **Converter** | `FilterConverter` | `FilterConverterWithSourceMap` |
| **Ruleset** | `Ruleset` (sync, in-memory) | `RulesetWithSourceMap` (lazy-load, source map) |
| **Input filter** | `IFilter` | `IFilterWithSource` |
| **Use case** | When you only need `DeclarativeRule[]` output from plain filter text | When you need source maps, `$badfilter` cross-filter application, and serialization |

### `IFilter` / `IFilterWithSource`

```ts
import type { IFilter, IFilterWithSource } from '@adguard/dnr-converter';
```

**`IFilter`** — minimal interface for the simple flow:

| Method | Type | Description |
| --- | --- | --- |
| `getId()` | `number` | Unique filter identifier |
| `getContent()` | `string` | Full text of the filter list (one rule per line) |

**`IFilterWithSource`** — extended interface for the advanced flow:

| Method | Type | Description |
| --- | --- | --- |
| `getId()` | `number` | Unique filter identifier |
| `getContent()` | `Promise<string>` | Returns the full text of the filter list |
| `getRuleByIndex(index)` | `Promise<string>` | Returns original rule text by character offset |
| `unloadContent()` | `void` | Releases parsed content from memory |

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
| `combine` | `boolean?` | Merge all input filters into a single combined rule set. |
| `badFilterRules` | `NetworkRule[]?` | Static `$badfilter` rules to apply at scan time (advanced flow only). |

### Simple flow: `FilterConverter` + `Ruleset`

Use this flow when you only need `DeclarativeRule[]` output from plain filter
text, without source maps or lazy loading.

```ts
import { FilterConverter } from '@adguard/dnr-converter';
import type { IFilter } from '@adguard/dnr-converter';

const filter: IFilter = {
    getId: () => 1,
    getContent: () => '||example.com^\n@@||example.com/path^',
};

const converter = new FilterConverter();
const [{ ruleSet, errors, limitations }] = await converter.convert([filter]);

console.log(ruleSet.getDeclarativeRules()); // DeclarativeRule[]
console.log(ruleSet.getRulesCount());       // 2
console.log(errors.length);                 // 0
```

**Combine multiple filters into one ruleset:**

```ts
const [{ ruleSet }] = await converter.convert(
    [filter1, filter2],
    { combine: true },
);
// ruleSet.getId() === FilterConverter.COMBINED_RULESET_ID
```

**Serialize and restore:**

```ts
const json = ruleSet.serialize();   // JSON string of DeclarativeRule[]

const { Ruleset } = await import('@adguard/dnr-converter');
const restored = Ruleset.deserialize(ruleSet.getId(), json);
```

`Ruleset` (returned by the simple flow) implements `IRuleset`:

| Method | Returns | Description |
| --- | --- | --- |
| `getId()` | `string` | Rule set identifier (e.g. `"ruleset_1"`) |
| `getRulesCount()` | `number` | Total number of declarative rules |
| `getUnsafeRulesCount()` | `number` | Count of unsafe rules |
| `getRegexpRulesCount()` | `number` | Count of regexp-based rules |
| `getDeclarativeRules()` | `DeclarativeRule[]` | All converted DNR rules (synchronous) |
| `serialize()` | `string` | JSON serialization of declarative rules |
| `Ruleset.deserialize(id, json)` | `Ruleset` | Static: reconstruct from serialized JSON |

### Advanced flow: `FilterConverterWithSourceMap` + `RulesetWithSourceMap`

Use this flow in browser extension internals when you need source maps,
`$badfilter` cross-filter application, serialization with hash maps, and lazy
content loading.

<!-- FIXME: Update this example once the `Filter` class is migrated to
     dnr-converter (AG-52708). Replace the raw `IFilterWithSource` stub
     with `new Filter(id, source)` and remove the manual method stubs. -->

```ts
import { FilterConverterWithSourceMap } from '@adguard/dnr-converter';
import type { IFilterWithSource } from '@adguard/dnr-converter';

const filter: IFilterWithSource = {
    getId: () => 1,
    getContent: async () => '||example.com^\n@@||example.com/path^',
    getRuleByIndex: async (_index) => '',
    getConversionData: () => undefined,
    unloadContent: () => {},
};

const converter = new FilterConverterWithSourceMap();
const [{ ruleSet, errors }] = await converter.convert([filter]);

const declarativeRules = await ruleSet.getDeclarativeRules(); // Promise<DeclarativeRule[]>
const sources = await ruleSet.getRulesById(declarativeRules[0].id);
console.log(sources[0].sourceRule); // '||example.com^'
```

**Apply `$badfilter` from dynamic filters against static rule sets:**

```ts
const [{ ruleSet: dynamicRuleSet }] = await converter.convert([dynamicFilter]);
const rulesToDisable = await converter.computeRulesToDisable(
    [dynamicRuleSet],
    [staticRuleSet],
);
// rulesToDisable: UpdateStaticRulesOptions[]
```

`RulesetWithSourceMap` (returned by the advanced flow) implements
`IRulesetWithSourceMap`:

| Method | Returns | Description |
| --- | --- | --- |
| `getId()` | `string` | Rule set identifier |
| `getRulesCount()` | `number` | Total number of declarative rules |
| `getUnsafeRulesCount()` | `number` | Count of unsafe rules |
| `getRegexpRulesCount()` | `number` | Count of regexp-based rules |
| `getDeclarativeRules()` | `Promise<DeclarativeRule[]>` | All converted DNR rules (lazy) |
| `getUnsafeRules()` | `Promise<DeclarativeRule[]>` | Unsafe rules subset (lazy) |
| `getRulesById(id)` | `Promise<SourceRuleAndFilterId[]>` | Source rules for a DNR rule |
| `getBadFilterRules()` | `NetworkRule[]` | `$badfilter` rules in this set |
| `getRulesHashMap()` | `IRulesHashMap` | Hash map for fast `$badfilter` matching |
| `serialize()` | `Promise<SerializedRuleset>` | Full serialization (rules + source map + hash map) |
| `serializeCompact(prettyPrint?, unsafeRules?)` | `Promise<string>` | Compact JSON serialization |
| `unloadContent()` | `void` | Release lazy-loaded content |

```ts
import type { ConversionResult } from '@adguard/dnr-converter';
```

Result returned by converter methods:

| Property | Type | Description |
| --- | --- | --- |
| `ruleSet` | `IRuleset` / `IRulesetWithSourceMap` | The converted rule set |
| `errors` | `(ConversionError \| Error)[]` | Rules that could not be converted |
| `limitations` | `LimitationError[]` | Warnings about exceeded limits |
| `declarativeRulesToCancel` | `UpdateStaticRulesOptions[]?` | Static rule IDs to disable (from `computeRulesToDisable`) |

### `MetadataRuleSet`

```ts
import { MetadataRuleSet, METADATA_RULESET_ID } from '@adguard/dnr-converter';
```

A specialized ruleset that stores checksums and additional properties for a
collection of DNR rule sets. It serializes as a single-element JSON array
containing a declarative rule with a `metadata` field, acting as a data
carrier within serialized ruleset files (never matches real requests).

`METADATA_RULESET_ID` is the constant `0`; the ruleset's string ID is always
`"ruleset_0"`.

**Checksum methods:**

| Method | Returns | Description |
| --- | --- | --- |
| `getId()` | `string` | Always `"ruleset_0"` |
| `setChecksum(ruleSetId, checksum)` | `void` | Store checksum for a rule set |
| `getChecksum(ruleSetId)` | `string \| undefined` | Retrieve checksum, or `undefined` if not set |
| `getRuleSetIds()` | `string[]` | All rule set IDs that have checksums |

**Additional-property methods:**

| Method | Returns | Description |
| --- | --- | --- |
| `setAdditionalProperty(key, value)` | `void` | Store an arbitrary JSON-serializable property |
| `getAdditionalProperty(key)` | `unknown \| undefined` | Retrieve a property value |
| `hasAdditionalProperty(key)` | `boolean` | Check whether a property exists |
| `removeAdditionalProperty(key)` | `void` | Remove a property (no-op if missing) |

**Serialization:**

| Method | Returns | Description |
| --- | --- | --- |
| `serialize(pretty?)` | `string` | JSON string; `pretty=true` for human-readable output |
| `MetadataRuleSet.deserialize(json)` | `MetadataRuleSet` | Reconstruct from a serialized string; throws on invalid input |

```ts
const meta = new MetadataRuleSet();
meta.setChecksum('ruleset_1', 'abc123');
meta.setAdditionalProperty('version', '2.0');

const json = meta.serialize();
const restored = MetadataRuleSet.deserialize(json);

console.log(restored.getChecksum('ruleset_1')); // "abc123"
console.log(restored.getAdditionalProperty('version')); // "2.0"
```

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

### `DNR_CONVERTER_VERSION`

```ts
import { DNR_CONVERTER_VERSION } from '@adguard/dnr-converter';

console.log(DNR_CONVERTER_VERSION); // e.g. "0.0.1"
```

A string constant with the current library version.

## Documentation

- [Changelog](CHANGELOG.md)
- [Development](DEVELOPMENT.md)
- [LLM agent rules](AGENTS.md)
