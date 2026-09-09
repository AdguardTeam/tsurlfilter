<!-- omit in toc -->
# Adblock rule converter

This directory contains adblock rule converter that can be used to convert rules from one adblocker format to another.
It is used by AdGuard to convert rules to AdGuard format, but in the future we plan to extend it to support other
formats.

>
> :warning: **This converter is still in development, currently it only supports converting Adblock Plus and uBlock
> Origin rules to AdGuard format.** Later we will plan to add support for other formats.
>

Table of contents:

- [Converter API](#converter-api)
    - [Two converter layers](#two-converter-layers)
    - [Returned interfaces](#returned-interfaces)
    - [Raw rule converter signature](#raw-rule-converter-signature)
    - [Raw filter list converter signature](#raw-filter-list-converter-signature)
    - [AST converter signatures](#ast-converter-signatures)
- [Reverse source map](#reverse-source-map)
- [Examples](#examples)
    - [Converting a single rule (string)](#converting-a-single-rule-string)
    - [Converting a filter list (string, with source map)](#converting-a-filter-list-string-with-source-map)
    - [Converting AST nodes](#converting-ast-nodes)
- [Limitations](#limitations)

## Converter API

The converter API is available by the `@adguard/agtree/converter` entrypoint:

```ts
import {
    RawRuleConverter,
    RawFilterListConverter,
    FilterListConversionResult,
    RuleConverter,
    FilterListConverter,
} from '@adguard/agtree/converter';
```

The same names are also re-exported from the package root (`@adguard/agtree`).

### Two converter layers

The converter exposes two layers, depending on whether you want to work with raw strings or with parsed AST nodes:

- **String (raw) layer** — the easiest to use. It parses, converts, and serializes internally, so you never touch an
  AST:
    - `RawRuleConverter`: converts a single raw adblock filtering rule string.
    - `RawFilterListConverter`: converts a whole raw filter list string and produces a reverse
      [`FilterListConversionResult`](#raw-filter-list-converter-signature) with a source map.
- **AST layer** — for callers that already have (or need) the parsed AST:
    - `RuleConverter`: converts a single rule AST node.
    - `FilterListConverter`: converts a whole filter list AST node.

Both layers share the same fixed internal parser detail level, so a rule converted via `RawRuleConverter` always
produces the same output as the same rule converted inside `RawFilterListConverter`. You never need to pass parser
flags.

Converter classes have the following methods:

- `convertToAdg`: converts to AdGuard format
- `convertToAbp`: converts to Adblock Plus format *(not implemented yet)*
- `convertToUbo`: converts to uBlock Origin format *(not implemented yet)*

### Returned interfaces

The string and AST layers return different result objects.

**AST layer** — `RuleConverter` and `FilterListConverter` return an object with:

- `result`: converted item(s)
- `isConverted`: `true` if the item(s) were converted, `false` otherwise

If the item(s) were not converted, the `result` field will contain the original item(s). For AST nodes, it means that
the returned AST node(s) will be the same as the input AST node(s), i.e. the **reference will be the same**.

**String layer** — `RawRuleConverter` returns the same `{ result, isConverted }` shape where `result` is an array of
strings; `RawFilterListConverter` returns a [`FilterListConversionResult`](#raw-filter-list-converter-signature) with
the fields:

- `converted`: converted filter list text
- `product`: target product (`ProductCode.Adg` for `convertToAdg`)
- `sourceMap`: a [`ConversionSourceMap`](#reverse-source-map) linking converted lines back to originals
- `errors`: non-fatal per-rule conversion errors (tolerant mode)
- `isConverted`: `true` if at least one rule was converted

### Raw rule converter signature

Raw rule converter has the following signature:

```ts
RawRuleConverter.convertToAdg(rawRule: string): ConversionResult<string, string[]>;
```

The reason why the converter returns an array of strings is that sometimes a single rule can be converted to multiple
rules in another adblocker format. For example, the following Adblock Plus rule:

```adblock
example.com#$#abp-snippet0 arg00 arg01; abp-snippet1 arg10 arg11
```

will be converted to the following AdGuard rules:

```adblock
example.com#%#//scriptlet('abp-snippet0', 'arg00', 'arg01')
example.com#%#//scriptlet('abp-snippet1', 'arg10', 'arg11')
```

So the general concept is that the rule converter always returns an array of strings, even if the array contains only
one string.

### Raw filter list converter signature

Raw filter list converter has the following signature:

```ts
RawFilterListConverter.convertToAdg(
    rawFilterList: string,
    options?: FilterListConvertOptions,
): FilterListConversionResult;
```

`FilterListConvertOptions` has a single `tolerant` flag (defaults to `true`): in tolerant mode a rule that fails to
parse or convert is kept verbatim and recorded in `errors`; in strict mode (`{ tolerant: false }`) the first failure is
rethrown.

The returned `FilterListConversionResult` also provides reverse-lookup helpers (see
[Reverse source map](#reverse-source-map)).

### AST converter signatures

```ts
RuleConverter.convertToAdg(rule: AnyRule): NodeConversionResult<AnyRule>;

FilterListConverter.convertToAdg(filterList: FilterList): ConversionResult<FilterList>;
```

Filter list converter returns a single filter list node, not an array of nodes, because it doesn't make sense to convert
a filter list to multiple filter lists, the converted filter list may contain a few more rules than the original
one.

## Reverse source map

`FilterListConversionResult` owns the mapping from the converted output back to the original rules. The map type is
`ConversionSourceMap`:

```ts
interface ConversionSourceMap {
    /**
     * Original text of every rule that was converted, in insertion order.
     */
    originals: string[];

    /**
     * Maps a converted-line start offset (0-based) to an index in `originals`.
     */
    conversions: Record<number, number>;
}
```

It is produced by `RawFilterListConverter.convertToAdg` and can be validated (e.g. after being persisted and read back
from storage) with `conversionSourceMapValidator` (`zod`). An empty map is created by
`createEmptyConversionSourceMap()`. In `@adguard/tsurlfilter` this type is re-exported under its legacy name
`ConversionData`.

The result object provides the following reverse-lookup helpers, all matching the legacy `tsurlfilter` `FilterList`
semantics:

- `getRuleText(offset)` — the (possibly converted) rule text at a converted-line offset.
- `getOriginalRuleText(offset)` — the original rule text at an offset, falling back to the converted rule text when the
  rule was not converted.
- `getConvertedRuleOriginal(offset)` — the original rule text only when the rule at the offset was actually converted,
  otherwise `null`.
- `getOriginalContent()` — reconstructs the original filter list content from the converted content and the source map.

## Examples

In this section we will show some examples of using the converter API.

### Converting a single rule (string)

```ts
import { RawRuleConverter } from '@adguard/agtree/converter';

const conversionResult = RawRuleConverter.convertToAdg(
    'example.com#$#abp-snippet0 arg00 arg01; abp-snippet1 arg10 arg11',
);

console.log(conversionResult.result.join('\n'));
// example.com#%#//scriptlet('abp-snippet0', 'arg00', 'arg01')
// example.com#%#//scriptlet('abp-snippet1', 'arg10', 'arg11')
```

### Converting a filter list (string, with source map)

```ts
import { RawFilterListConverter } from '@adguard/agtree/converter';

const filterListToConvert = `! Title: Example filter list
example.com#$#abp-snippet0 arg00 arg01; abp-snippet1 arg10 arg11
||example.com/foo.js^$script,rewrite=blank-js`;

const result = RawFilterListConverter.convertToAdg(filterListToConvert);

console.log(result.converted);
// ! Title: Example filter list
// example.com#%#//scriptlet('abp-snippet0', 'arg00', 'arg01')
// example.com#%#//scriptlet('abp-snippet1', 'arg10', 'arg11')
// ||example.com/foo.js^$script,redirect=noopjs

console.log(result.isConverted); // true
console.log(result.sourceMap.originals);
// [
//   'example.com#$#abp-snippet0 arg00 arg01; abp-snippet1 arg10 arg11',
//   '||example.com/foo.js^$script,rewrite=blank-js',
// ]

// The original list can be reconstructed byte-for-byte:
console.log(result.getOriginalContent() === filterListToConvert); // true

// Reverse lookup of the original rule for any converted line start offset:
const convertedLineOffset = result.converted.indexOf("example.com#%#//scriptlet('abp-snippet0', 'arg00', 'arg01')");
console.log(result.getOriginalRuleText(convertedLineOffset));
// example.com#$#abp-snippet0 arg00 arg01; abp-snippet1 arg10 arg11
```

### Converting AST nodes

```ts
import { RuleParserPipeline } from '@adguard/agtree';
import { RuleConverter } from '@adguard/agtree/converter';
import { RuleGenerator } from '@adguard/agtree/generator';

const rawRuleToConvert = 'example.com#$#abp-snippet0 arg00 arg01; abp-snippet1 arg10 arg11';

// Parse the rule to get an AST rule node.
// Please note that the parser will throw an error if the rule is
// syntactically incorrect.
const parser = new RuleParserPipeline();
const ruleNode = parser.parse(rawRuleToConvert);

// Now you can use the converter API by passing the AST node as an input.
// Please note that the converter API returns an array of rule nodes,
// not a single rule node.
const conversionResult = RuleConverter.convertToAdg(ruleNode);

// You can simply serialize the rule nodes, then print them to the console
// this way:
console.log(conversionResult.result.map(RuleGenerator.generate).join('\n'));
```

## Limitations

Please note that the converter has some limitations:

- **Rule converter is not a full-fledged validator**, it only checks necessary conditions for conversion. It simply
  tries to everything possible to convert, but maybe the conversion result will be invalid. You should use a separate
  validator to check whether the rule is valid or not.
- Rule converter doesn't support all possible cases, for example currently it cannot convert multiple rules to a single
  rule.
- Only `convertToAdg` is implemented; `convertToUbo` and `convertToAbp` throw a `NotImplementedError`. The result's
  `product` is always `ProductCode.Adg`.
- The list converter decides whether to build an AST per rule using a sound candidate pre-filter: network rules with no
  modifiers and blank lines are copied verbatim, while cosmetic rules and comments are always parsed. This is
  intentionally conservative (it may parse a rule that ends up unchanged, but never skips a rule the converter would
  change).
