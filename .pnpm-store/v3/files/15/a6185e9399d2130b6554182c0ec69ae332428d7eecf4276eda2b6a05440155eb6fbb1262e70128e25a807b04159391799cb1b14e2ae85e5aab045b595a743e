# Filters Downloader

## Filters downloader package

This utility tool resolves preprocessor directives in filter content.

### Directives syntax

```adblock
!#if condition
Anything goes here
!#include URL_or_a_relative_path
!#endif
```

or with an `else` branch:

```adblock
!#if condition
!#include URL_or_a_relative_path
!#else
!#include another_URL_or_a_relative_path
!#endif
```

- `!#if`, `!#else`, `!#endif` — filters maintainers can use these conditions
  to supply different rules depending on the ad blocker type.
- `condition` — just like in some popular programming languages,
  pre-processor conditions are based on constants declared by ad blockers.
  Ad blocker authors define on their own what exact constants do they declare.
- `!#include` — this directive allows to include contents of a specified file into the filter.

#### Logical conditions

When an adblocker encounters an `!#if` directive and no `!#else` directive,
it will compile the code between `!#if` and `!#endif` only if the specified condition is true.

If there is an `!#else` directive, the code between `!#if` and `!#else` will be compiled if the condition is true,
otherwise the code between `!#else` and `!#endif` will be compiled.

Condition supports all the basic logical operators, i.e. `&&`, `||`, `!` and parentheses.

Example:

```adblock
!#if (adguard && !adguard_ext_safari)
||example.org^$third-party
!#endif
```

#### Include

The `!#include` directive supports only files from the same origin
to make sure that the filter maintainer is in control of the specified file.
The included file can also contain pre-processor directives (even other !#include directives).

Ad blockers should consider the case of recursive !#include and implement a protection mechanism.

Examples:

Filter URL: `https://example.org/path/filter.txt`

```adblock
!
! Valid (same origin):
!#include https://example.org/path/includedfile.txt
!
! Valid (relative path):
!#include /includedfile.txt
!#include ../path2/includedfile.txt
!
! Invalid (another origin):
!#include https://example.com/path/includedfile.txt
```

## Build

To build one file for browser environment:

```bash
yarn build
```

See `./dist` directory for results.

## Usage

### Installation

```
yarn add @adguard/filters-downloader
```

```js
const FilterCompilerConditionsConstants = {
    adguard: true,
    // ...
    adguard_ext_android_cb: false
};

// Option One
let promise = FiltersDownloader.download("resources/rules.txt", FilterCompilerConditionsConstants);
promise.then((compiled) => {
    // Success
}, (exception) => {
    // Error
});

// Option Two
let promise = FiltersDownloader.compile(['rule'], 'http://example.com', FilterCompilerConditionsConstants);
promise.then((compiled) => {
    // Success
}, (exception) => {
    // Error
});

// The downloadWithRaw() method downloads a filter, applies patches if possible and resolves conditionals;
// if patch applying fails, isPatchUpdateFailed will be true.
const { filter, rawFilter, isPatchUpdateFailed } = await FiltersDownloader.downloadWithRaw(
    url,
    {
        force: false,
        rawFilter: prevRawFilter,
    },
);
```

## Tests

```bash
yarn test
```

## Linter

```bash
yarn lint
```
