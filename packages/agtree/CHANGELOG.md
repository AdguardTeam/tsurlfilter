<!-- markdownlint-disable MD024 -->
# AGTree Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog][keepachangelog], and this project adheres to [Semantic Versioning][semver].

[keepachangelog]: https://keepachangelog.com/en/1.0.0/
[semver]: https://semver.org/spec/v2.0.0.html

## [2.0.2] - 2024-09-09

### Fixed

- Handling last position in `PositionProvider`.

### Removed

- Browser-specific builds. If you need to use AGTree in browser environment, you can use jsDelivr's automatic builds
  or bundlers like Webpack / Rollup / ESBuild without any issues, AGTree does not have any non-browser-compatible code.

[2.0.2]: https://github.com/AdguardTeam/tsurlfilter/releases/tag/agtree-v2.0.2

## [2.0.1] - 2024-09-06

### Added

- Support for uBO's legacy `script:inject` mask.
- Support for uBO's redirect priority in the compatibility table name normalization.
- `resource_types` field to the redirects compatibility table.
- Support for converting network rules to uBO syntax.

### Fixed

- Conversion for uBO's `rc` and `ra` scriptlets.
- Converter now unescape scriptlet separators from the previous rule, if needed (e.g. it unescape commas when converting
  from uBO to AG syntax).

[2.0.1]: https://github.com/AdguardTeam/tsurlfilter/releases/tag/agtree-v2.0.1

## [2.0.0] - 2024-08-15

### Added

- Integrated `@adguard/css-tokenizer` package.
- Adjustable syntax parsing. This makes possible to disable parsing of uBO and ABP syntaxes, which can be useful when
  parsing known-syntax filters.
- `PositionProvider` to convert offsets to line/column pairs.
- `OutputByteBuffer` and `InputByteBuffer` utility classes.
- Binary serialization / deserialization for AST nodes. Practically, this means adding `serialize` and `deserialize`
  methods to AGTree classes.
- `decodeTextPolyfill` and `encodeIntoPolyfill` utility functions.
- `includeRaws` parser option.
- `HostRuleParser` parser class to make it possible to parse host-like rules to `HostRule` node.
- Compatibility table API.
- Compatibility table wiki, which is generated via the compatibility table API.
- Protected Audience API directives to `$permissions` modifier validator.
- Possibility to convert scriptlet rules to uBO syntax.
- Performance benchmarking.

### Changed

- Reworked CSS parsing. Now it is based on `@adguard/css-tokenizer` package, and only necessary parts of CSS are parsed.
- Consistent signature for all parser classes: `ParserClass.parse(source, options)`.
- Location parsing now optional. It can be disabled by passing `isLocIncluded: false` option to the parsers. This
  reduces memory consumption and improves performance if location is not needed.
- Modifier node's `modifier` property renamed to `name`.
- `ScriptletInjectionBodyParser` divided into `AdgScriptletInjectionBodyParser`, `UboScriptletInjectionBodyParser`
  and `AbpSnippetInjectionBodyParser`.
- Locations (`offset`, `line`, `column`) are changed to only one `offset` value. If you need to get line/column, you
  should use `PositionProvider` class.
- Parser functions signature to `parse(source, options, baseOffset, ...additionalArgs)`.
- Removed `Parameter` node from the AST and replaced it with `Value` node.
- If a parameter is empty, it parsed as `null` instead of empty string.
- `SimpleCommentParser` now has a separate class.
- Logical operator types are now consistent, we only use the `OperatorValue` enum.
- Reworked the compatibility table structure.
- Library now use CJS.
- `version` export renamed to `AGTREE_VERSION`.

### Fixed

- HTML rule converter now correctly handles the new `:contains()` syntax.
- Location handling for `FilterListParser`.
- Performance issues.

### Removed

- `@adguard/scriptlets` library. It is not needed anymore, because AGTree now has its own compatibility tables.
- `css-tree` library. It is not needed anymore, because AGTree now uses `@adguard/css-tokenizer` package.
- `##^`/`#@#^` and `##+`/`#@#+` from the cosmetic rule separator finder. Instead, `##`/`#@#` is used, and the `^`/`+` is
  checked in the body parser.

[2.0.0]: https://github.com/AdguardTeam/tsurlfilter/releases/tag/agtree-v2.0.0

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
