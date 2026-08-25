# DNR Converter Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.1.2] - 2026-08-25

### Changed

- Updated [@adguard/scriptlets] to `v2.5.1`.

## [1.1.1] - 2026-08-24

### Fixed

- Unknown and unsupported modifiers were silently discarded during MV3
  conversion, which could turn the remaining rule into a broader blocking or
  allow DNR rule [AdguardFilters#238305].
- Value-less `$removeparam` rules (e.g. `||example.org^$removeparam`) converted
  into blocking DNR rules instead of a redirect that removes the whole query
  string, so matching sites were blocked [AdguardBrowserExtension#3602].
- Unanchored `$urltransform` substitution patterns did not match query strings
  in MV3 [AdguardBrowserExtension#3600].

[AdguardFilters#238305]: https://github.com/AdguardTeam/AdguardFilters/issues/238305
[AdguardBrowserExtension#3602]: https://github.com/AdguardTeam/AdguardBrowserExtension/issues/3602
[AdguardBrowserExtension#3600]: https://github.com/AdguardTeam/AdguardBrowserExtension/issues/3600

## [1.1.0] - 2026-07-28

### Changed

- `RegularRuleConverter` now uses a template method (`groupConverted()`) instead
  of having each subclass duplicate `convert()`. `CspConverter` and
  `RemoveHeaderConverter` override `groupConverted()` instead.
- Renamed `DEFAULT_DEST_RULE_SETS_DIR` to `DEFAULT_DEST_RULESETS_DIR` in the CLI.
- Updated `.eslintrc.cjs` to align with other packages: separated
  `builtin`/`external` import groups, added `@adguard/**` pathGroups,
  added `curly` rule.
- Renamed `test/src/rulesets/` to `test/src/ruleset/` to match source directory
  naming.

### Fixed

- Fixed stale `@typedef` import paths in `TooManyError` subclasses (pointed to
  non-existent `../../source-map` instead of `../../ruleset/source-map`).
- Fixed README: repo URL, added `$urltransform` and `$cookie` to supported
  modifiers, corrected `NetworkRule[]` → `Rule[]` in ConverterOptions docs.
- Removed redundant `FilterConverterOptions` duplicate export.

### Removed

- Deleted dead `bamboo-specs/scripts/dnr-converter-tests.sh` (never referenced
  by CI).

[1.1.0]: https://github.com/AdguardTeam/tsurlfilter/releases/tag/dnr-converter-v1.1.0


## [1.0.0] - 2026-07-10

### Added

- Initial release: DNR conversion stack (rule converters, rulesets, source maps,
  CLI) extracted from `@adguard/tsurlfilter`.

[1.1.2]: https://github.com/AdguardTeam/tsurlfilter/releases/tag/dnr-converter-v1.1.2
[1.1.1]: https://github.com/AdguardTeam/tsurlfilter/releases/tag/dnr-converter-v1.1.1
[1.0.0]: https://github.com/AdguardTeam/tsurlfilter/releases/tag/dnr-converter-v1.0.0

[@adguard/scriptlets]: https://github.com/AdguardTeam/Scriptlets/blob/master/CHANGELOG.md
