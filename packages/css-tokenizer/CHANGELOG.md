# CSS Tokenizer Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog][keepachangelog], and this project adheres to [Semantic Versioning][semver].

[keepachangelog]: https://keepachangelog.com/en/1.0.0/
[semver]: https://semver.org/spec/v2.0.0.html

## [Unreleased]

### Added

### Changed

### Deprecated

### Removed

### Fixed

- A right parenthesis inside a single-quoted `:xpath()` literal no longer
  closes an Extended CSS pseudo-class early. A quotation mark of the other
  kind inside such a literal no longer breaks the pseudo-class either.
  `:xpath()` now tracks both quote characters in XPath literals, e.g.
  `:xpath(//div[contains(text(),')')])` and
  `:xpath(//div[@a='x"y'])`. A literal ends only at its own quotation mark,
  because XPath literals have no escape sequences, so the pseudo-class
  `:xpath(//div[@a="C:\"])` closes at the right parenthesis instead of
  consuming the rest of the input. The same holds when the opening
  quotation mark follows a reverse solidus:
  `:xpath(//div[@a=\"x"])` now also closes at the pseudo-class `)`. A
  reverse solidus still escapes a parenthesis, and an escaped reverse
  solidus does not escape the parenthesis after it, e.g.
  `:xpath(//a[contains(a\\)])`.
- A right parenthesis inside a regexp character class no longer closes an
  extended CSS pseudo-class early. Regexp literals are recognized both as
  the whole raw argument, e.g. `:has-text(/a[)]b/)`, and as the
  `property: value` part, e.g.
  `:matches-css(background-image: /^url\([)]/)`. Classes that contain other
  parentheses or brackets are handled as well, e.g.
  `:has-text(/[^)(]+/)`, `:has-text(/[)[]/)` and
  `:has-text(/document\.write[(]/)`. A solidus without an unescaped closing
  one is still treated as plain text, so arguments such as
  `:has-text(/foo[bar)` keep the previous behavior.
- A regexp literal moves the argument end only when a right parenthesis that
  closes the argument follows it, so a later part of the selector cannot
  turn a plain-text argument into a regexp. A right parenthesis after an
  escaped reverse solidus, e.g. `:has-text(/(a\\)/)`, now closes the
  argument as well.
- A regexp literal in a following extended CSS pseudo-class no longer extends
  the argument of the previous one, so `:contains(foo):matches-css(color: /red/)`
  and `:matches-css(position: fixed):matches-css(z-index: /\d+/)` tokenize as
  two separate pseudo-classes. The search for a literal opener stops at the
  class-blind closing parenthesis of the current argument, so it cannot reach
  a later pseudo-class and no longer scans the rest of the selector for every
  pseudo-class. A literal that starts inside the argument may still run past
  that parenthesis, e.g. `:has-text(/a[)]b/)`.
- A right parenthesis inside a quoted value no longer closes an extended CSS
  pseudo-class argument early, e.g. `:matches-css(a: "x)y", b: /c/)` keeps
  the whole argument. A quoted value is recognized after a colon, a comma or
  an equals sign, so `:matches-attr(data-x="a)b")` and
  `:matches-css(a: /c[)]d/, e: "f)g")` keep their arguments as well. An
  apostrophe in plain text, e.g. `:contains(it's)`, does not start a quoted
  value, so it does not hide the closing parenthesis.
- A quote inside a regexp literal no longer pairs with a quote of a following
  pseudo-class, and a quote whose closing quote is not followed by the rest of
  the argument is plain text. Selectors such as
  `:contains(/a:"b/), span:contains("c")` and
  `:has(:contains(/label:"open/)):contains("next")` tokenize as separate
  pseudo-classes.
- A character class of a regexp literal that has no closing square bracket no
  longer makes the scan run to the end of the selector for every regexp
  literal opener. Such a literal is rejected as soon as the class opens.

### Security

## [1.3.0] - 2026-11-12

### Added

- `remove-attr` and `remove-class` pseudo-classes to Extended CSS handlers
  [AdguardBrowserExtension#3538].

[AdguardBrowserExtension#3538]: https://github.com/AdguardTeam/AdguardBrowserExtension/issues/3538
[1.3.0]: https://github.com/AdguardTeam/tsurlfilter/releases/tag/css-tokenizer-v1.3.0

## [1.2.0] - 2025-01-31

### Added

- Stop functionality to `CSS tokenizer` callback and implement `hasToken` function.

[1.2.0]: https://github.com/AdguardTeam/tsurlfilter/releases/tag/css-tokenizer-v1.2.0

## [1.1.1] - 2024-09-19

### Fixed

- Optimized build size.

[1.1.1]: https://github.com/AdguardTeam/tsurlfilter/releases/tag/css-tokenizer-v1.1.1

## [1.1.0] - 2024-09-18

### Removed

- Browser builds.

[1.1.0]: https://github.com/AdguardTeam/tsurlfilter/releases/tag/css-tokenizer-v1.1.0

## [1.0.0] - 2024-08-15

### Added

- Identifier decoder utility.
- `matches-property` and `matches-attr` pseudo-classes to Extended CSS handlers.
- ESM and UMD builds.

### Changed

- `version` export renamed to `CSS_TOKENIZER_VERSION`.

### Removed

- Export for `TOKEN_NAMES`. Please use `getBaseTokenName` instead.

### Fixed

- Consuming whitespace after escape sequences.

[1.0.0]: https://github.com/AdguardTeam/tsurlfilter/releases/tag/css-tokenizer-v1.0.0

## [0.0.1] - 2023-10-30

### Added

- Initial release.

[0.0.1]: https://github.com/AdguardTeam/tsurlfilter/releases/tag/css-tokenizer-v0.0.1
