# Migration Guide: from `@adguard/tsurlfilter` declarative-converter to `@adguard/dnr-converter`

This guide helps consumers migrate from the old
`@adguard/tsurlfilter/es/declarative-converter` subpath export to the new
standalone `@adguard/dnr-converter` package.

## Installation

Remove the old dependency (if no longer needed for other tsurlfilter features)
and install the new package:

```bash
pnpm install @adguard/dnr-converter
# @adguard/re2-wasm is declared as a peer dependency in @adguard/dnr-converter;
# install it alongside:
pnpm install @adguard/re2-wasm@1.2.0
```

## Import Path Changes

| Before | After |
| --- | --- |
| `import { ... } from '@adguard/tsurlfilter/es/declarative-converter'` | `import { ... } from '@adguard/dnr-converter'` |
| `import { ... } from '@adguard/tsurlfilter/es/declarative-converter-utils'` | Not needed — utilities are internal |

## Renamed Exports

| Old name (tsurlfilter) | New name (dnr-converter) | Notes |
| --- | --- | --- |
| `DeclarativeFilterConverter` | `FilterConverter` | Same role, new API |
| `Filter` (from tsurlfilter) | `Filter` | New constructor signature (see below) |
| `IRuleset` | `IRuleset` / `IRulesetWithSourceMap` | Split into two interfaces by mode |
| `NetworkRule` | `Rule` | Migrated from tsurlfilter, new class |
| `DeclarativeRule` | `DeclarativeRule` | Same (Chrome DNR rule type) |
| `ConversionResult` | `ConversionResult` | Same structure |

## API Changes

### FilterConverter

**Before (tsurlfilter):**

```ts
import { DeclarativeFilterConverter, Filter } from '@adguard/tsurlfilter/es/declarative-converter';

const converter = new DeclarativeFilterConverter();
const filter = new Filter(
    0,
    { getContent: async () => new FilterList(rulesText) },
    true,
);

// Dynamic conversion
const { ruleset } = await converter.convertDynamicRulesets([filter], [], options);

// Static conversion
const { ruleset } = await converter.convertStaticRuleset(filter, options);
```

**After (dnr-converter):**

```ts
import { FilterConverter, Filter } from '@adguard/dnr-converter';

const converter = new FilterConverter();

// Simple mode (no source maps)
const filter = new Filter(0, rulesText);
const [{ ruleset }] = await converter.convert([filter], options);
const rules = ruleset.getDeclarativeRules(); // synchronous

// Advanced mode (with source maps, lazy loading)
const lazyFilter = new Filter(0, async () => rulesText);
const [{ ruleset }] = await converter.convert([lazyFilter], { ...options, withSourceMap: true });
const rules = await ruleset.getDeclarativeRules(); // async
```

### Filter Construction

**Before:**

```ts
const filter = new Filter(
    filterId,
    { getContent: async () => new FilterList(content) },
    true, // trusted flag
);
```

**After:**

```ts
// Pre-loaded (content in memory)
const filter = new Filter(filterId, content);

// Lazy-loaded (async callback)
const filter = new Filter(filterId, async () => fetchContent());
```

### Ruleset Access

**Before:**

```ts
const declarativeRules = await ruleset.getDeclarativeRules();
```

**After (simple mode):**

```ts
const declarativeRules = ruleset.getDeclarativeRules(); // synchronous
```

**After (advanced mode with `withSourceMap: true`):**

```ts
const declarativeRules = await ruleset.getDeclarativeRules(); // async
const sources = await ruleset.getRulesById(ruleId);
```

### $badfilter Cross-Filter Application

**Before:**

```ts
const { ruleset } = await converter.convertDynamicRulesets(
    [dynamicFilter],
    staticRulesets,
    options,
);
// $badfilter applied internally
```

**After:**

```ts
const [{ ruleset: dynamicRuleset }] = await converter.convert(
    [dynamicFilter],
    { withSourceMap: true },
);
const rulesToDisable = await converter.computeRulesToDisable(
    [dynamicRuleset],
    staticRulesets,
);
// Returns UpdateStaticRulesOptions[] for chrome.declarativeNetRequest.updateStaticRules()
```

## Removed Exports

The following are no longer exported (internal implementation details):

- `FilterList` — replaced by `Filter` with string content
- `RULESET_NAME_PREFIX` — use `Ruleset.getId()` / `RulesetWithSourceMap.getId()`
- `NetworkIndexedRuleWithHash` — internal
- `SourceMap` (class) — use `IRulesetWithSourceMap.getRulesById()`

## Configuration

The old `setConfiguration()` call from tsurlfilter is no longer needed.
The converter operates without global configuration.

## CLI

The package now ships a CLI tool (`dnr-converter`) for batch conversion:

```bash
dnr-converter convert ./filters ./resources ./dist/rulesets
dnr-converter extract-filters ./dist/rulesets ./extracted
```

See [README.md CLI section](README.md#cli) for full documentation.
