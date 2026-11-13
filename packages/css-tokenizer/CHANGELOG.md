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
