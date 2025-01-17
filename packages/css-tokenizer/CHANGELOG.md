# CSS Tokenizer Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog][keepachangelog], and this project adheres to [Semantic Versioning][semver].

[keepachangelog]: https://keepachangelog.com/en/1.0.0/
[semver]: https://semver.org/spec/v2.0.0.html

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
