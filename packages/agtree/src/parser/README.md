# Adblock rule parser

This directory contains adblock rule parser. It supports all syntaxes
currently in use:

- <img src="https://cdn.adguard.com/website/github.com/AGLint/adg_logo.svg" width="14px"> [AdGuard][adg-url]
- <img src="https://cdn.adguard.com/website/github.com/AGLint/ubo_logo.svg" width="14px"> [uBlock Origin][ubo-url]
- <img src="https://cdn.adguard.com/website/github.com/AGLint/abp_logo.svg" width="14px"> [Adblock Plus][abp-url]
- <img src="https://cdn.adguard.com/website/github.com/AGLint/ab_logo.svg" width="14px"> [AdBlock][ab-url]

Table of contents:

- [Adblock rule parser](#adblock-rule-parser)
    - [Parser API](#parser-api)
    - [Examples](#examples)
        - [Parsing single adblock rules](#parsing-single-adblock-rules)
        - [Generating adblock rules from AST](#generating-adblock-rules-from-ast)
        - [Parsing and generating complete filter lists](#parsing-and-generating-complete-filter-lists)

[ab-url]: https://getadblock.com
[abp-url]: https://adblockplus.org
[adg-url]: https://adguard.com
[ubo-url]: https://github.com/gorhill/uBlock

## Parser API

The parser API is available in the `@adguard/agtree` package:

```ts
import { RuleParser, FilterListParser } from '@adguard/agtree';
```

The idea is quite simple, we provide two *main* parser classes:

- `RuleParser`: parses a single adblock filtering rule, you can pass any rule to it, it will automatically determine the
  rule type
- `FilterListParser`: parses a complete adblock filter list, you can pass any filter list to it. Technically, it is just
  a wrapper around `RuleParser`

Each parser class has the following methods:

- `parse`: parses a raw data (string) and returns an AST (Abstract Syntax Tree) node (string &#8594; AST)
- `generate`: serializes an AST node back to a string (AST &#8594; string)

We also provide some "sub-parser" classes, which are used by the main parser classes:

- `ModifierListParser`: handles modifier lists
- `DomainListParser`: handles domain lists
- etc.

Currently, these helper classes are not documented here, but you can find them in the source code. We only recommend
them **only for advanced use cases and please keep in mind that they may change in the future**.

## Examples

In this section we will show some examples of using the parser API.

### Parsing single adblock rules

Here is an example of parsing a single adblock rule with `RuleParser`:

```typescript
import { RuleParser } from "@adguard/agtree";

// RuleParser automatically determines the rule type, no need to specify it
const ast = RuleParser.parse("/ads.js^$script");
```

After running this script, basically you will get the following AST:

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

This is a simplified version of the AST, it does not contain locations and raw data. You can check the full AST by
opening the spoiler below:

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

As you can see, this AST is very detailed and contains all the information about the rule: syntax, category, exception,
modifiers, node locations, and so on. Locations are especially useful for linters, since they allow you to point to the
exact place in the rule where the error occurred.

### Generating adblock rules from AST

If you want to generate a raw string rule from the AST, you can use the `generate` method:

```typescript
RuleParser.generate(ast);
```

This will generate the adblock rule back from the AST:

```adblock
/ads.js^$script
```

Please keep in mind that the parser omits unnecessary whitespaces, so the generated rule may not match with the original
rule character by character. Only the formatting can change, the rule itself remains the same. You can pass any rule to
the parser, it automatically determines the type and category of the rule. If the rule is syntactically incorrect, the
parser will throw an error.

### Parsing and generating complete filter lists

You can also parse complete filter lists using the `FilterListParser` class. It works the same way as the `RuleParser`
class. Here is an example of parsing [EasyList](https://easylist.to/easylist/easylist.txt) and generating it back:

```typescript
import { FilterListParser } from "@adguard/agtree";
import { writeFile } from "fs/promises";
// Requires installing "node-fetch" package
// npm install node-fetch
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
