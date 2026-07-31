<!-- markdownlint-disable -->
&nbsp;
<p align="center">
    <picture>
        <source media="(prefers-color-scheme: dark)" srcset="https://cdn.adtidy.org/website/github.com/AGTree/agtree_darkmode.svg" />
        <img alt="AGTree" src="https://cdn.adtidy.org/website/github.com/AGTree/agtree_lightmode.svg" width="350px" />
    </picture>
</p>
<h3 align="center">Tool set for working with adblock filter lists</h3>
<p align="center">Supported syntaxes:</p>
<p align="center">
    <img src="https://cdn.adguard.com/website/github.com/AGLint/adg_logo.svg" width="14px" alt="AdGuard logo" /> <a href="https://adguard.com">AdGuard</a>
    | <img src="https://cdn.adguard.com/website/github.com/AGLint/ubo_logo.svg" width="14px" alt="uBlock Origin logo" /> <a href="https://github.com/gorhill/uBlock">uBlock Origin</a>
    | <img src="https://cdn.adguard.com/website/github.com/AGLint/ab_logo.svg" width="14px" alt="AdBlock logo" /> <a href="https://getadblock.com">AdBlock</a>
    | <img src="https://cdn.adguard.com/website/github.com/AGLint/abp_logo.svg" width="14px" alt="Adblock Plus logo" /> <a href="https://adblockplus.org">Adblock Plus</a>
</p>
<p align="center">
    <a href="https://www.npmjs.com/package/@adguard/agtree"><img src="https://img.shields.io/npm/v/@adguard/agtree" alt="NPM version" /></a>
    <a href="https://www.npmjs.com/package/@adguard/agtree"><img src="https://img.shields.io/npm/dm/@adguard/agtree" alt="NPM Downloads" /></a>
    <a href="https://github.com/AdguardTeam/tsurlfilter/blob/master/packages/agtree/LICENSE"><img src="https://img.shields.io/npm/l/@adguard/agtree" alt="License" /></a>
</p>
<!-- markdownlint-restore -->

## What is AGTree?

AGTree is a tool set for working with adblock filter lists. It contains the following modules:

- [Adblock rule parser][parser-url] — the v5 `RuleParserPipeline` is imported from `@adguard/agtree`;
  the structural parser stage is importable via the `@adguard/agtree/parser` subpath
- [Adblock rule generator][generator-url] — importable via the `@adguard/agtree/generator` subpath
- [Adblock rule converter][converter-url] — importable via the `@adguard/agtree/converter` subpath
- [Adblock rule validator][validator-url] — re-exported through the package root (`@adguard/agtree`)
- [Compatibility tables][compatibility-tables-url] — re-exported through the package root (`@adguard/agtree`)
- [Utils][utils-url] — importable via the `@adguard/agtree/utils` subpath
- [AST walker][walker-url] — importable via the `@adguard/agtree/walker` subpath

> [!NOTE]
> Modules whose source lives in `src/` directories — such as `ast-utils/`
> helpers like `parseDomainList` — are re-exported through the package root
> (`@adguard/agtree`), not via separate subpaths.

## Installation

You can install the library using

- [Yarn][yarn-pkg-manager-url]: `yarn add @adguard/agtree`
- [NPM][npm-pkg-manager-url]: `npm install @adguard/agtree`
- [PNPM][pnpm-pkg-manager-url]: `pnpm add @adguard/agtree`

> [!IMPORTANT]
> AGTree is an ESM-only package and requires Node.js version 22 or higher.

[yarn-pkg-manager-url]: https://yarnpkg.com/en/docs/install
[npm-pkg-manager-url]: https://www.npmjs.com/get-npm
[pnpm-pkg-manager-url]: https://pnpm.io/

## Quick start

> [!NOTE]
> The v5 pipeline API below is **preview/alpha**. AGTree is currently at
> `5.0.0-alpha.0`; the public surface may change before 5.0.0 GA.

Install and import:

```ts
import {
    RuleParserPipeline,
    FilterListPipeline,
    parseDomainList,
    PIPE_MODIFIER_SEPARATOR,
    COMMA_DOMAIN_LIST_SEPARATOR,
    hasNativeCssPseudoClass,
    RuleCategory,
    NetworkRuleType,
    type ParseOptions,
} from '@adguard/agtree';
import { RuleGenerator } from '@adguard/agtree/generator';
```

### Parse a single rule

```ts
const parser = new RuleParserPipeline();

// A network rule:
const networkRule = parser.parse('||example.com^$script');
if (networkRule.category === RuleCategory.Network
    && networkRule.type === NetworkRuleType.NetworkRule) {
    console.log(networkRule.pattern.value); // "||example.com^"
}

// A cosmetic (element-hiding) rule:
const cosmeticRule = parser.parse('##.banner');
if (cosmeticRule.category === RuleCategory.Cosmetic) {
    console.log(cosmeticRule.type); // e.g. "ElementHidingRule"
}
```

### Parse a whole filter list

```ts
const filterListPipeline = new FilterListPipeline();
const list = filterListPipeline.parse([
    '! Title: Example',
    '||example.com^$script',
    '##.banner',
].join('\n'));

console.log(list.children.length); // number of top-level nodes
```

### Parse a `$domain` value

```ts
// Pipe-separated (AdGuard default):
const domains = parseDomainList('example.com|~example.org', undefined, 0, PIPE_MODIFIER_SEPARATOR);
console.log(domains.children.map((c) => c.value));      // ["example.com", "example.org"]
console.log(domains.children.map((c) => c.exception));  // [false, true]

// Comma-separated (e.g. ABP/uBO):
parseDomainList('a.com,b.com', undefined, 0, COMMA_DOMAIN_LIST_SEPARATOR);
```

### Parse an `/etc/hosts`-style host rule

```ts
// Host rules are opt-in via the `parseHostRules` flag on ParseOptions:
const host = parser.parse('127.0.0.1 example.com example.org', {
    parseHostRules: true,
});

if (host.category === RuleCategory.Network
    && host.type === NetworkRuleType.HostRule) {
    console.log(host.ip.value);                          // "127.0.0.1"
    console.log(host.hostnames.children.map((h) => h.value)); // ["example.com", "example.org"]
}
```

### Round-trip: parse → mutate → serialize

```ts
const node = parser.parse('||example.com^$script');
const text = RuleGenerator.generate(node); // "||example.com^$script"
```

### Check a selector for native CSS pseudo-classes

```ts
hasNativeCssPseudoClass('div:has(> a)'); // true  — :has() is native in modern browsers
hasNativeCssPseudoClass('div.banner > a'); // false
```

### `ParseOptions`

The pipeline accepts parse-time flags via `ParseOptions` (see
[OVERVIEW.md](src/OVERVIEW.md#parseoptions--parse-time-flags) for the full
interface):

```ts
const located = parser.parse('||example.com^', { isLocIncluded: true });
```

## Documentation

- [Changelog](CHANGELOG.md)
- [Development guide](../../DEVELOPMENT.md)
- [Package LLM agent rules](AGENTS.md)

## Ideas & Questions

If you have any questions or ideas for new features, please [open an issue][new-issue-url] or a
[discussion][discussions-url]. We will be happy to discuss it with you.

## License

AGTree is licensed under the MIT License. See the [LICENSE][license-url] file for details.

## References

Here are some useful links to help you write adblock rules. This list is not exhaustive, so if you know any other useful
resources, please let us know.

<!--markdownlint-disable MD013-->
- Syntax documentation:
    - <img src="https://cdn.adguard.com/website/github.com/AGLint/adg_logo.svg" width="14px" alt="AdGuard logo"> [AdGuard: *How to create your own ad filters*][adg-filters]
    - <img src="https://cdn.adguard.com/website/github.com/AGLint/ubo_logo.svg" width="14px" alt="uBlock Origin logo"> [uBlock Origin: *Static filter syntax*][ubo-filters]
    - <img src="https://cdn.adguard.com/website/github.com/AGLint/abp_logo.svg" width="14px" alt="Adblock Plus logo"> [Adblock Plus: *How to write filters*][abp-filters]
- Extended CSS documentation:
    - [MDN: *CSS selectors*][mdn-css-selectors]
    - <img src="https://cdn.adguard.com/website/github.com/AGLint/adg_logo.svg" width="14px" alt="AdGuard logo"> [AdGuard: *Extended CSS capabilities*][adg-ext-css]
    - <img src="https://cdn.adguard.com/website/github.com/AGLint/ubo_logo.svg" width="14px" alt="uBlock Origin logo"> [uBlock Origin: *Procedural cosmetic filters*][ubo-procedural]
    - <img src="https://cdn.adguard.com/website/github.com/AGLint/abp_logo.svg" width="14px" alt="Adblock Plus logo"> [Adblock Plus: *Extended CSS selectors*][abp-ext-css]
- Scriptlets:
    - <img src="https://cdn.adguard.com/website/github.com/AGLint/adg_logo.svg" width="14px" alt="AdGuard logo"> [AdGuard scriptlets][adg-scriptlets]
    - <img src="https://cdn.adguard.com/website/github.com/AGLint/ubo_logo.svg" width="14px" alt="uBlock Origin logo"> [uBlock Origin scriptlets][ubo-scriptlets]
    - <img src="https://cdn.adguard.com/website/github.com/AGLint/abp_logo.svg" width="14px" alt="Adblock Plus logo"> [Adblock Plus snippets][abp-snippets]
- <img src="https://cdn.adguard.com/website/github.com/AGLint/adg_logo.svg" width="14px" alt="AdGuard logo"> [AdGuard's compatibility table][adg-compatibility-table]
<!--markdownlint-enable MD013-->

[abp-ext-css]: https://help.eyeo.com/adblockplus/how-to-write-filters#elemhide-emulation
[abp-filters]: https://help.eyeo.com/adblockplus/how-to-write-filters
[abp-snippets]: https://help.eyeo.com/adblockplus/snippet-filters-tutorial#snippets-ref
[adg-compatibility-table]: https://github.com/AdguardTeam/Scriptlets/blob/master/wiki/compatibility-table.md
[adg-ext-css]: https://github.com/AdguardTeam/ExtendedCss/blob/master/README.md
[adg-filters]: https://kb.adguard.com/en/general/how-to-create-your-own-ad-filters
[adg-scriptlets]: https://github.com/AdguardTeam/Scriptlets/blob/master/wiki/about-scriptlets.md#scriptlets
[compatibility-tables-url]: https://github.com/AdguardTeam/tsurlfilter/tree/master/packages/agtree/src/compatibility-tables
[converter-url]: https://github.com/AdguardTeam/tsurlfilter/tree/master/packages/agtree/src/converter
[discussions-url]: https://github.com/AdguardTeam/tsurlfilter/discussions
[generator-url]: https://github.com/AdguardTeam/tsurlfilter/tree/master/packages/agtree/src/generator
[license-url]: https://github.com/AdguardTeam/tsurlfilter/blob/master/packages/agtree/LICENSE
[mdn-css-selectors]: https://developer.mozilla.org/en-US/docs/Web/CSS/CSS_Selectors
[new-issue-url]: https://github.com/AdguardTeam/tsurlfilter/issues/new
[parser-url]: https://github.com/AdguardTeam/tsurlfilter/tree/master/packages/agtree/src/parser
[utils-url]: https://github.com/AdguardTeam/tsurlfilter/tree/master/packages/agtree/src/utils
[validator-url]: https://github.com/AdguardTeam/tsurlfilter/tree/master/packages/agtree/src/validator
[walker-url]: https://github.com/AdguardTeam/tsurlfilter/tree/master/packages/agtree/src/walker
[ubo-filters]: https://github.com/gorhill/uBlock/wiki/Static-filter-syntax
[ubo-procedural]: https://github.com/gorhill/uBlock/wiki/Procedural-cosmetic-filters
[ubo-scriptlets]: https://github.com/gorhill/uBlock/wiki/Resources-Library#available-general-purpose-scriptlets
