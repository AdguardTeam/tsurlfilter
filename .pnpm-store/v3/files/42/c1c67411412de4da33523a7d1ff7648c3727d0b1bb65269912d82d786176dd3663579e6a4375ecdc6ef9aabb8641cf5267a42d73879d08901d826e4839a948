# csslex

This aims to be a very small and very fast spec compliant css lexer (or scanner
or tokenizer depending on your favourite nomenclature).

It is not _the_ fastest, nor is it _the_ smallest, but it chooses to trade size
for speed and speed for correctness. Smaller lexers exist but they sacrifice
speed and correctness. Faster lexers exist but they sacrifice code size, and the
ability to easily run in the browser. More clearly written lexers exist, but
usually at the sacrifice of both speed and size. For details on how fast, how
small, and how correct, see below.

## What is this good for?

The applications are quite limited. If you know what CSS is, and you know what a
lexer/scanner/tokenizer is, then you probably know why you would want this. If
you don't know those things or how you could use them, then this probably won't
be helpful for you.

## How do I import this?

If you're using node.js then running `npm i csslex` which will install the
dependency in your `node_modules` folder. Then import it with:

```ts
import { lex, types, value } from "csslex";
```

If you're using Deno, then you can try the following line:

```ts
import { lex, types, value } from "https://deno.land/x/csslex/mod.ts";
```

If you're using a Browser, you can import using unpkg or esm.sh:

```ts
import { lex, types, value } from "https://esm.sh/csslex";
```

## How do I use this?

If you can understand typescript, this will be helpful:

```ts
type Token = [type: typeof types[keyof typeof types], start: number, end: number]
lex(css: string): Generator<Token>
```

The main `lex` function takes a css string, and creates an iterable of "Tokens".
Each "Token" is a tuple 3 (an array always with 3 elements inside it). The first
item in the array is the number representing the type, the second is the start
position of that token in the css string, the second is the end of that token in
the string.

So for example:

```js
import { lex, types, value } from "https://esm.sh/csslex";
Array.from(lex("margin: 1px"))[ // -> output
  ([types.IDENT, 0, 6],
  [types.COLON, 6, 7],
  [types.WHITESPACE, 7, 8][(types.DIMENSION, 8, 11)])
];
```

If you want to know the raw value of a token, simply take your original string
and call `.slice(start, end)`. However you can also give the string and a token
tuple to `value` which will also do extra things like normalise escape
characters and give you structural values:

```js
import { lex, types, value } from "https://esm.sh/csslex";
value("margin: 1px", [types.IDENT, 0, 6]) == "margin";
value("margin: 1px", [types.COLON, 6, 7]) == ":";
value("margin: 1px", [types.DIMENSION, 8, 11]) ==
  { type: "integer", value: 1, unit: "px" };
```

## Test Coverage

This uses [`css-tokenizer-tests`][1] which provides a set of difficult inputs
intended to test the edge cases of the spec.

It also uses "snapshot testing" to avoid regressions, it tokenizes the
[`postcss-parser-tests`][2] series of css files, as well as [`open-props`][3].

[1]: https://github.com/romainmenke/css-tokenizer-tests
[2]: https://www.npmjs.com/package/postcss-parser-tests/v/8.3.1
[3]: https://github.com/argyleink/open-props

## Spec Conformance

[@romainmenke][4] maintains a comparison of
[CSS tokenizers with scores pertaining to each][5]. `csslex` aims to always
achieve a perfect score here, so if you visit the [scores page][5] an it does
not have a perfect score, please file an issue!

[4]: https://github.com/romainmenke
[5]: https://romainmenke.github.io/css-tokenizer-tests/

## Size Differentials

This package aims to be the smallest minified css tokenizer codebase. Here's a
comparison of popular alternatives:

|           Name            | Minified | Gzipped |
| :-----------------------: | :------- | :------ |
|   `@csstools/tokenizer`   | 4.1kb    | 1.1kb   |
|      `csslex` (this)      | 4.7kb    | 1.9kb   |
| `@csstools/css-tokenizer` | 15.5kb   | 3.4kb   |
|      `css-tokenize`       | 19.1kb   | 5.7kb   |
|        `parse-css`        | 16kb     | 4.1kb   |
|        `css-tree`         | 157.9kb  | 45kb    |

## Speed differentials

You can run `node bench.js` to get some benchmark numbers. Here's some I ran on
the machine I developed the library on:

|          Name           | ops/sec                                |
| :---------------------: | :------------------------------------- |
|        css-tree         | 3,080 ops/sec ±0.43% (96 runs sampled) |
|      csslex (this)      | 2,314 ops/sec ±0.45% (93 runs sampled) |
| @csstools/css-tokenizer | 1,622 ops/sec ±0.76% (96 runs sampled) |
