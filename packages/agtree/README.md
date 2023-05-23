&nbsp;

<p align="center">
  <picture>
    <source
      media="(prefers-color-scheme: dark)"
      srcset="
        https://cdn.adtidy.org/website/github.com/AGTree/agtree_darkmode.svg
      "
    />
    <img
      alt="AGTree"
      src="https://cdn.adtidy.org/website/github.com/AGTree/agtree_lightmode.svg"
      width="350px"
    />
  </picture>
</p>
<h3 align="center">Universal adblock filter list parser</h3>
<p align="center">Supported syntaxes:</p>
<p align="center">
  <a href="https://adguard.com"
    ><img
      src="https://cdn.adguard.com/website/github.com/AGLint/adg_logo.svg"
      width="14px"
    />
    AdGuard</a
  >
  |
  <a href="https://github.com/gorhill/uBlock"
    ><img
      src="https://cdn.adguard.com/website/github.com/AGLint/ubo_logo.svg"
      width="14px"
    />
    uBlock Origin</a
  >
  |
  <a href="https://getadblock.com"
    ><img
      src="https://cdn.adguard.com/website/github.com/AGLint/ab_logo.svg"
      width="14px"
    />
    AdBlock</a
  >
  |
  <a href="https://adblockplus.org"
    ><img
      src="https://cdn.adguard.com/website/github.com/AGLint/abp_logo.svg"
      width="14px"
    />
    Adblock Plus</a
  >
</p>

<p align="center">
  <a href="https://www.npmjs.com/package/@adguard/agtree"
    ><img src="https://img.shields.io/npm/v/@adguard/agtree" alt="NPM version"
  /></a>
  <a href="https://www.npmjs.com/package/@adguard/agtree"
    ><img
      src="https://img.shields.io/npm/dm/@adguard/agtree"
      alt="NPM Downloads"
  /></a>
  <a href="https://github.com/AdguardTeam/AGTree/blob/master/LICENSE"
    ><img src="https://img.shields.io/npm/l/@adguard/agtree" alt="License"
  /></a>
</p>

Table of Contents:

- [Introduction](#introduction)
- [Usage](#usage)
  - [Parsing rules](#parsing-rules)
  - [Parsing filter lists](#parsing-filter-lists)
- [Development \& Contribution](#development--contribution)
- [Ideas \& Questions](#ideas--questions)
- [License](#license)
- [References](#references)

## Introduction

AGTree is a universal adblock filter list parser. It supports all syntaxes
currently in use: AdGuard, uBlock Origin and AdBlock / Adblock Plus.

## Usage

AGTree provides a powerful, error-tolerant parser for all kinds of ad blocking
rules. It fully supports AdGuard, uBlock Origin and Adblock Plus syntaxes, and
provides a high-detail AST for all rules.

Basically, the parser API has two main parts:

- Parser: parsing rules (string &#8594; AST)
- Generator: serialization of ASTs (AST &#8594; string)

### Parsing rules

You can parse individual rules using the `RuleParser` class. It has a `parse`
method that takes a rule string and returns an AST. For example, this code:

```typescript
import { RuleParser } from "@adguard/agtree";

// RuleParser automatically determines the rule type
const ast = RuleParser.parse("/ads.js^$script");
```

will gives you this AST:

```json
{
  "type": "NetworkRule",
  "category": "Network",
  "syntax": "Common",
  "exception": false,
  "pattern": {
    "type": "Value",
    "value": "/ads.js^"
  },
  "modifiers": {
    "type": "ModifierList",
    "children": [
      {
        "type": "Modifier",
        "modifier": {
          "type": "Value",
          "value": "script"
        },
        "exception": false
      }
    ]
  }
}
```

<details>

<summary>Show full AST (with locations)</summary>

```json
{
  "type": "NetworkRule",
  "loc": {
    "start": {
      "offset": 0,
      "line": 1,
      "column": 1
    },
    "end": {
      "offset": 15,
      "line": 1,
      "column": 16
    }
  },
  "raws": {
    "text": "/ads.js^$script"
  },
  "category": "Network",
  "syntax": "Common",
  "exception": false,
  "pattern": {
    "type": "Value",
    "loc": {
      "start": {
        "offset": 0,
        "line": 1,
        "column": 1
      },
      "end": {
        "offset": 8,
        "line": 1,
        "column": 9
      }
    },
    "value": "/ads.js^"
  },
  "modifiers": {
    "type": "ModifierList",
    "loc": {
      "start": {
        "offset": 9,
        "line": 1,
        "column": 10
      },
      "end": {
        "offset": 15,
        "line": 1,
        "column": 16
      }
    },
    "children": [
      {
        "type": "Modifier",
        "loc": {
          "start": {
            "offset": 9,
            "line": 1,
            "column": 10
          },
          "end": {
            "offset": 15,
            "line": 1,
            "column": 16
          }
        },
        "modifier": {
          "type": "Value",
          "loc": {
            "start": {
              "offset": 9,
              "line": 1,
              "column": 10
            },
            "end": {
              "offset": 15,
              "line": 1,
              "column": 16
            }
          },
          "value": "script"
        },
        "exception": false
      }
    ]
  }
}
```

</details>

As you can see, this AST is very detailed and contains all the information about
the rule: syntax, category, exception, modifiers, node locations, and so on.
Locations are especially useful for linters, since they allow you to point to
the exact place in the rule where the error occurred.

And this code:

```typescript
RuleParser.generate(ast);
```

will generate the adblock rule from the AST (serialization):

```adblock
/ads.js^$script
```

Please keep in mind that the parser omits unnecessary whitespaces, so the
generated rule may not match with the original rule character by character.
Only the formatting can change, the rule itself remains the same. You can
pass any rule to the parser, it automatically determines the type and category
of the rule. If the rule is syntactically incorrect, the parser will throw an
error.

### Parsing filter lists

You can also parse complete filter lists using the `FilterListParser` class.
It works the same way as the `RuleParser` class. Here is an example of parsing
[EasyList](https://easylist.to/easylist/easylist.txt) and generating it back:

```typescript
import { FilterListParser } from "@adguard/agtree";
import { writeFile } from "fs/promises";
// Requires installing "node-fetch" package
import fetch from "node-fetch";

// Download EasyList
const easyList = await (
  await fetch("https://easylist.to/easylist/easylist.txt")
).text();

// Or read it from file
// const easyList = await readFile('easylist.txt', 'utf-8');

// Parse EasyList to AST. By default, parser is very tolerant,
// if it can't parse some rules, it will just mark them as "raw".
// If you want to disable this behavior, you can pass the second
// argument as "false" to the "parse" method, like this:
// const ast = FilterListParser.parse(easyList, false);
const ast = FilterListParser.parse(easyList);

// Generate filter list from filter list AST
const easyListGenerated = FilterListParser.generate(ast);

// Write generated filter list to file
await writeFile("easylist-generated.txt", easyListGenerated);
```

## Development & Contribution

Please read the [CONTRIBUTING.md](CONTRIBUTING.md) file for details on how to
contribute to this project.

## Ideas & Questions

If you have any questions or ideas for new features, please open an issue or a
discussion. We will be happy to discuss it with you.

## License

AGTree is licensed under the MIT License. See the [LICENSE](LICENSE) file for
details.

## References

Here are some useful links to help you write adblock rules. This list is not
exhaustive, so if you know any other useful resources, please let us know.

- Syntax documentation:
  - [AdGuard: _How to create your own ad filters_][adg-filters]
  - [uBlock Origin: _Static filter syntax_][ubo-filters]
  - [Adblock Plus: _How to write filters_][abp-filters]
- Extended CSS documentation:
  - [MDN: _CSS selectors_][mdn-css-selectors]
  - [AdGuard: _Extended CSS capabilities_][adg-ext-css]
  - [uBlock Origin: _Procedural cosmetic filters_][ubo-procedural]
  - [Adblock Plus: _Extended CSS selectors_][abp-ext-css]
- Scriptlets:
  - [AdGuard scriptlets][adg-scriptlets]
  - [uBlock Origin scriptlets][ubo-scriptlets]
  - [Adblock Plus snippets][abp-snippets]
- Third party libraries:
  - [CSSTree docs][css-tree-docs]
- [AdGuard's compatibility table][adg-compatibility-table]

[abp-ext-css]: https://help.eyeo.com/adblockplus/how-to-write-filters#elemhide-emulation
[abp-filters]: https://help.eyeo.com/adblockplus/how-to-write-filters
[abp-snippets]: https://help.eyeo.com/adblockplus/snippet-filters-tutorial#snippets-ref
[adg-compatibility-table]: https://github.com/AdguardTeam/Scriptlets/blob/master/wiki/compatibility-table.md
[adg-ext-css]: https://github.com/AdguardTeam/ExtendedCss/blob/master/README.md
[adg-filters]: https://kb.adguard.com/en/general/how-to-create-your-own-ad-filters
[adg-scriptlets]: https://github.com/AdguardTeam/Scriptlets/blob/master/wiki/about-scriptlets.md#scriptlets
[css-tree-docs]: https://github.com/csstree/csstree/tree/master/docs
[mdn-css-selectors]: https://developer.mozilla.org/en-US/docs/Web/CSS/CSS_Selectors
[ubo-filters]: https://github.com/gorhill/uBlock/wiki/Static-filter-syntax
[ubo-procedural]: https://github.com/gorhill/uBlock/wiki/Procedural-cosmetic-filters
[ubo-scriptlets]: https://github.com/gorhill/uBlock/wiki/Resources-Library#available-general-purpose-scriptlets
