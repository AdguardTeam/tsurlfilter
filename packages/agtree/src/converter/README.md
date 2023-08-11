# Adblock rule converter

This directory contains adblock rule converter that can be used to convert rules from one adblocker format to another.
It is used by AdGuard to convert rules to AdGuard format, but in the future we plan to extend it to support other
formats.

>
> :warning: **This converter is still in development, currently it only supports converting Adblock Plus and uBlock
> Origin rules to AdGuard format.** Later we will plan to add support for other formats.
>

Table of contents:

- [Adblock rule converter](#adblock-rule-converter)
    - [Converter API](#converter-api)
        - [Rule converter signature](#rule-converter-signature)
        - [Filter list converter signature](#filter-list-converter-signature)
    - [Examples](#examples)
        - [Examples of converting a single rule](#examples-of-converting-a-single-rule)
        - [Examples of converting a filter list](#examples-of-converting-a-filter-list)
    - [Limitations](#limitations)

## Converter API

The converter API is available in the `@adguard/agtree` package:

```ts
import { RuleConverter, FilterListConverter } from '@adguard/agtree';
```

The idea is quite simple, we provide two converter classes:

- `RuleConverter`: converts a single adblock filtering rule
- `FilterListConverter`: converts a complete adblock filter list (this is just a wrapper around `RuleConverter`)

Converter classes have the following methods:

- `convertToAdg`: converts to AdGuard format
- `convertToAbp`: converts to Adblock Plus format *(not implemented yet)*
- `convertToUbo`: converts to uBlock Origin format *(not implemented yet)*

Each converter method expects an AST (Abstract Syntax Tree) node as an input and returns the converted AST node(s) as an
output. **This means that you should parse the rule/filter list first**, then pass the AST node to the converter, which
will also return AST node(s). If necessary, you can serialize the converted AST node(s) back to a string afterwards.

### Rule converter signature

Rule converter has the following signature:

```ts
RuleConverter.convertToAdg(rule: AnyRule): AnyRule[];
```

The reason why the converter returns an array of nodes is that sometimes a single rule can be converted to multiple
rules in another adblocker format. For example, the following Adblock Plus rule:

```adblock
example.com#$#abp-snippet0 arg00 arg01; abp-snippet1 arg10 arg11
```

will be converted to the following AdGuard rules:

```adblock
example.com#%#//scriptlet('abp-snippet0', 'arg00', 'arg01')
example.com#%#//scriptlet('abp-snippet1', 'arg10', 'arg11')
```

So the general concept is that the rule converter always returns an array of nodes, even if the array contains only one
node.

### Filter list converter signature

Filter list converter has the following signature:

```ts
FilterListConverter.convertToAdg(filterList: FilterList): FilterList;
```

Filter list converter returns a single filter list node, not an array of nodes, because it doesn't make sense to convert
a filter list to multiple filter lists, simply the converted filter list may contains a few more rules than the original
one.

## Examples

In this section we will show some examples of using the converter API.

### Examples of converting a single rule

```ts
import { RuleParser, RuleConverter } from '@adguard/agtree';

const rawRuleToConvert = 'example.com#$#abp-snippet0 arg00 arg01; abp-snippet1 arg10 arg11';

// Parse the rule to get an AST rule node.
// Please note that the parser will throw an error if the rule is
// syntactically incorrect.
const ruleNode = RuleParser.parse(rawRuleToConvert);

// Now you can use the converter API by passing the AST node as an input.
// Please note that the converter API returns an array of rule nodes,
// not a single rule node.
// Please also note that the converter API will throw an error if the
// rule is invalid or cannot be converted.
const conversionResult = RuleConverter.convertToAdg(ruleNode);

// You can simply serialize the rule nodes, then print them to the console
// this way:
console.log(conversionResult.map(RuleParser.generate).join('\n'));
```

### Examples of converting a filter list

```ts
import { FilterListParser, FilterListConverter } from '@adguard/agtree';
import { readFileSync, writeFileSync } from 'fs';

const filterListToConvert = `[Adblock Plus 3.1]
! Title: Example filter list
! Description: This is an example filter list
! Expires: 1 day
! Homepage: https://example.com
! Version: 1.0
! License: MIT
example.com#$#abp-snippet0 arg00 arg01; abp-snippet1 arg10 arg11
||example.com/foo.js^$script,rewrite=blank-js`;

// Or you can read the filter list from a file:
// const filterListToConvert = readFileSync('filter-list-to-convert.txt', 'utf8');

// Filter list converter is a special case and returns a single filter list node,
// not an array of nodes, because it doesn't make sense to convert a filter list
// to multiple filter lists.
const convertedFilterList = FilterListConverter.convertToAdg(
    FilterListParser.parse(filterListToConvert),
);

// You can simply serialize the filter list node, then print it to the console
console.log(FilterListParser.generate(convertedFilterList));

// Or you can serialize the filter list node to a string and write it to a file
// writeFileSync('converted-filter-list.txt', FilterListParser.generate(convertedFilterList));
```

## Limitations

Please note that the converter has some limitations:

- **Rule converter is not a full-fledged validator**, it only checks necessary conditions for conversion. It simply
  tries to everything possible to convert, but maybe the conversion result will be invalid. You should use a separate
  validator to check whether the rule is valid or not.
- Rule converter doesn't support all possible cases, for example currently it cannot convert multiple rules to a single
  rule.
