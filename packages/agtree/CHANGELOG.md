# AGTree Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog][keepachangelog], and this project adheres to [Semantic Versioning][semver].

[keepachangelog]: https://keepachangelog.com/en/1.0.0/
[semver]: https://semver.org/spec/v2.0.0.html

## Unreleased

### Added

- Compatibility table API.
- Compatibility table wiki, which is generated from the compatibility table API.

### Changed

- Reworked the compatibility table structure.
- Library now use CJS.

### Removed

- Scriptlets library, since it is not needed anymore, because AGTree now has its own compatibility tables.

## 1.1.8 - 2024-04-24

### Added

- Export path for type declarations.
- Support for `fenced-frame-src`, `referrer`, `require-trusted-types-for`, `script-src-attr`, `script-src-elem`,
  `style-src-attr`, `style-src-elem`, `trusted-types` CSP directives for `$csp` modifier validation: [#126].

[#126]: https://github.com/AdguardTeam/tsurlfilter/issues/126


## 1.1.7 - 2023-11-07

### Added

- Support of `referrerpolicy` modifier [#98].

[#98]: https://github.com/AdguardTeam/tsurlfilter/issues/98


## 1.1.6 - 2023-09-22

### Changed

- Converter now returns an object with `result` and `isConverted` properties instead of just `result`
- Filter list converter now accepts a second argument `tolerant` which allows to convert filter lists with invalid rules

### Added

- `RawRuleConverter` class for converting raw rules
- `RawFilterListConverter` class for converting raw filter lists

### Fixed

- Improved converter's performance


## 1.1.5 - 2023-09-05

### Changed

- Validation of `$csp` and `$permissions` modifiers value
  by custom pre-defined validator instead of regular expression

### Added

- Exports to `package.json`


## 1.1.4 - 2023-08-30

### Fixed

- Validation of `$redirect` and `$replace` modifiers by `ModifierValidator.validate()`


## 1.1.3 - 2023-08-28

### Added

- Validation of modifier values due to `value_format`

## Changed

- `ModifierValidator.validate()` result type `ValidationResult` — `valid` property instead of `ok`


## 1.1.2 - 2023-08-14

### Fixed

- Compatibility tables validation of ABP syntax `$rewrite`
- Detecting closing parenthesis in ADG/uBO scriptlets while parsing


## 1.1.1 - 2023-08-11

### Fixed

- Validation of assignable modifiers which may be used without a value


## 1.1.0 - 2023-08-10

### Added

- Compatibility tables for modifiers
- Validator for modifiers
- Basic rule converter
- New utils (regex, quotes)

### Changed

- Updated dependencies
- Improved library build
- Improved CSSTree utils
- Export CSSTree utils
- Store raw data while parsing
- General code improvements

### Fixed

- Package metadata
- Type import/export
- Modifier list parsing
- Scriptlet parsing
- Metadata parsing


## 1.0.1 - 2023-05-24

### Added

- Migrated parser from AGLint to a separate package.
