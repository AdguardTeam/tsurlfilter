<!-- markdownlint-disable MD024 -->
# AGTree Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog], and this project adheres to [Semantic Versioning].

[Keep a Changelog]: https://keepachangelog.com/en/1.0.0/
[Semantic Versioning]: https://semver.org/spec/v2.0.0.html

## [3.1.5] - 2025-05-20

### Added

- UBO alias `nofab.js` for AdGuard *scriptlet* `prevent-fab-3.2.0`.

[3.1.5]: https://github.com/AdguardTeam/tsurlfilter/releases/tag/agtree-3.1.5

## [3.1.4] - 2025-05-19

### Fixed

- Updated `zod` dependency to version `3.24.4` to resolve vulnerability warnings.

[3.1.4]: https://github.com/AdguardTeam/tsurlfilter/releases/tag/agtree-3.1.4

## [3.1.3] - 2025-04-29

### Added

- Export of `FilterListGenerator` from `@adguard/agtree/generator`.

[3.1.3]: https://github.com/AdguardTeam/tsurlfilter/releases/tag/agtree-3.1.3

## [3.1.2] - 2025-04-23

### Added

- Export of `FilterListConverter` and `RawRuleConverter`.

[3.1.2]: https://github.com/AdguardTeam/tsurlfilter/releases/tag/agtree-3.1.2

## [3.1.1] - 2025-04-17

### Changed

- Proper conversion of the cosmetic rule separators to uBlock Origin format.
- Limit conversion of `ADG` scriptlets to `uBO` if no equivalents are available.

### Fixed

- Removed a space in the list of parameters in the `safari_cb_affinity` directive.

[3.1.1]: https://github.com/AdguardTeam/tsurlfilter/releases/tag/agtree-3.1.1

## [3.1.0] - 2025-03-31

### Added

- Converter of `ADG` cosmetic rule modifier list to `uBO`.

[3.1.0]: https://github.com/AdguardTeam/tsurlfilter/releases/tag/agtree-3.1.0

## [3.0.1] - 2025-02-28

The version is the same as [3.0.0-alpha.5], just removed `alpha` channel.

[3.0.1]: https://github.com/AdguardTeam/tsurlfilter/releases/tag/agtree-3.0.1

## [3.0.0-alpha.5] - 2025-02-07

### Changed

- No `semver` usage in `agent-parser` to improve code speed, reduce bundle size
  and avoid issues with ESM imports.

[3.0.0-alpha.5]: https://github.com/AdguardTeam/tsurlfilter/releases/tag/agtree-3.0.0-alpha.5

## [3.0.0-alpha.4] - 2025-02-03

### Changed

- Updated [@adguard/css-tokenizer] to `v1.2.0` which introduces the `hasToken` function.

[3.0.0-alpha.4]: https://github.com/AdguardTeam/tsurlfilter/releases/tag/agtree-3.0.0-alpha.4

## [3.0.0-alpha.3] - 2025-01-30

### Changed

- Better usage of ESM pure imports for `tldts` dependency.

[3.0.0-alpha.3]: https://github.com/AdguardTeam/tsurlfilter/releases/tag/agtree-v3.0.0-alpha.3

## [3.0.0-alpha.2] - 2024-12-17

### Changed

- Switched to a pure ESM package.

[3.0.0-alpha.2]: https://github.com/AdguardTeam/tsurlfilter/releases/tag/agtree-v3.0.0-alpha.2

## [3.0.0-alpha.1] - 2024-12-11

### Changed

- The API is separated across entry points: `@adguard/agtree/parser`, `@adguard/agtree/generator`,
  `@adguard/agtree/converter`, `@adguard/agtree/validator`, `@adguard/agtree/compatibility-tables`,
  and `@adguard/agtree/utils`.

[3.0.0-alpha.1]: https://github.com/AdguardTeam/tsurlfilter/releases/tag/agtree-v3.0.0-alpha.1

### Fixed

- Fixed missing children data in the deserializer for certain nodes.
- Add error messages for rules parsing errors.

## [2.3.0] - 2024-12-19

### Added

- Support for ABP-syntax CSS injection rules [tsurlfilter#143].

[2.3.0]: https://github.com/AdguardTeam/tsurlfilter/releases/tag/agtree-v2.3.0
[tsurlfilter#143]: https://github.com/AdguardTeam/tsurlfilter/issues/143

## [2.2.0] - 2024-11-27

### Removed

- `xregexp` library as a runtime dependency. It remains a development dependency for processing YAML files,
  enabling enhanced readability and maintainability of regex patterns through free-spacing mode and inline comments.
  However, xregexp is no longer bundled with the library to significantly reduce memory usage and bundle size,
  improving overall performance.
  The library now uses native ECMAScript regex patterns at runtime, ensuring compatibility
  without the additional overhead of xregexp. Related to [AdguardBrowserExtension#3037].

[2.2.0]: https://github.com/AdguardTeam/tsurlfilter/releases/tag/agtree-v2.2.0
[AdguardBrowserExtension#3037]: https://github.com/AdguardTeam/AdguardBrowserExtension/issues/3037

## [2.1.4] - 2024-11-25

### Added

- Error messages for rules parsing errors.

### Fixed

- Missing children data in the deserializer for certain nodes.

[2.1.4]: https://github.com/AdguardTeam/tsurlfilter/releases/tag/agtree-v2.1.4

## [2.1.3] - 2024-10-21

### Fixed

- Optimized performance of parsing uBlock filter parameters [AdguardBrowserExtension#2962].

[AdguardBrowserExtension#2962]: https://github.com/AdguardTeam/AdguardBrowserExtension/issues/2962
[2.1.3]: https://github.com/AdguardTeam/tsurlfilter/releases/tag/agtree-v2.1.3

## [2.1.2] - 2024-09-19

### Fixed

- `RegExpUtils.isRegexPattern()` if a regexp contains a slash inside the pattern.

[2.1.2]: https://github.com/AdguardTeam/tsurlfilter/releases/tag/agtree-v2.1.2

## [2.1.1] - 2024-09-19

### Fixed

- Optimized build size.

[2.1.1]: https://github.com/AdguardTeam/tsurlfilter/releases/tag/agtree-v2.1.1

## [2.1.0] - 2024-09-18

### Added

- `UboParameterListParser` to parse uBO parameter lists, like scriptlet parameters.

### Changed

- Scriptlet injection parser now requires quotes for AdGuard scriptlets and uses `UboParameterListParser` for uBO
  scriptlets to provide more consistent parsing.

[2.1.0]: https://github.com/AdguardTeam/tsurlfilter/releases/tag/agtree-v2.1.0

## [2.0.2] - 2024-09-10

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
- Converter now unescape scriptlet separators from the previous rule, if needed,
  e.g. it unescapes commas when converting from uBO to AG syntax.

[2.0.1]: https://github.com/AdguardTeam/tsurlfilter/releases/tag/agtree-v2.0.1

## [2.0.0] - 2024-08-15

### Added

- Integrated [@adguard/css-tokenizer] package.
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

### Removed

- `@adguard/scriptlets` library. It is not needed anymore, because AGTree now has its own compatibility tables.
- `css-tree` library. It is not needed anymore, because AGTree now uses `@adguard/css-tokenizer` package.
- `##^`/`#@#^` and `##+`/`#@#+` from the cosmetic rule separator finder. Instead, `##`/`#@#` is used, and the `^`/`+` is
  checked in the body parser.

### Fixed

- HTML rule converter now correctly handles the new `:contains()` syntax.
- Location handling for `FilterListParser`.
- Performance issues.

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

- Converter now returns an object with `result` and `isConverted` properties instead of just `result`.
- Filter list converter now accepts a second argument `tolerant` which allows
  to convert filter lists with invalid rules.

### Added

- `RawRuleConverter` class for converting raw rules.
- `RawFilterListConverter` class for converting raw filter lists.

### Fixed

- Improved converter's performance.

## 1.1.5 - 2023-09-05

### Changed

- Validation of `$csp` and `$permissions` modifiers value
  by custom pre-defined validator instead of regular expression.

### Added

- Exports to `package.json`.

## 1.1.4 - 2023-08-30

### Fixed

- Validation of `$redirect` and `$replace` modifiers by `ModifierValidator.validate()`.

## 1.1.3 - 2023-08-28

### Added

- Validation of modifier values due to `value_format`.

## Changed

- `ModifierValidator.validate()` result type `ValidationResult` — `valid` property instead of `ok`.

## 1.1.2 - 2023-08-14

### Fixed

- Compatibility tables validation of ABP syntax `$rewrite`.
- Detecting closing parenthesis in ADG/uBO scriptlets while parsing.

## 1.1.1 - 2023-08-11

### Fixed

- Validation of assignable modifiers which may be used without a value.

## 1.1.0 - 2023-08-10

### Added

- Compatibility tables for modifiers.
- Validator for modifiers.
- Basic rule converter.
- New utils (regex, quotes).

### Changed

- Updated dependencies.
- Improved library build.
- Improved CSSTree utils.
- Export CSSTree utils.
- Store raw data while parsing.
- General code improvements.

### Fixed

- Package metadata.
- Type import/export.
- Modifier list parsing.
- Scriptlet parsing.
- Metadata parsing.

## 1.0.1 - 2023-05-24

### Added

- Migrated parser from AGLint to a separate package.

[@adguard/css-tokenizer]: ../css-tokenizer/CHANGELOG.md
