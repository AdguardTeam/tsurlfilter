# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## Unreleased <!-- release/browser-extension-v5.2 -->

### Added

- `utils` entry point with `getVersion` and `getVersionTimestampMs` functions.

## [3.0.0-alpha.12] - 2025-05-28

### Changed

- Updated `@adguard/tsurlfilter` to `v3.3.4`.

### Fixed

- Types for `NodeNext` module resolution.

[3.0.0-alpha.12]: https://github.com/AdguardTeam/tsurlfilter/releases/tag/dnr-rulesets-v3.0.0-alpha.12

## [3.0.0-alpha.7] - 2025-05-19

### Changed

- Updated `@adguard/tsurlfilter` to `v3.3.2`.

### Fixed

- Updated `zod` dependency to version `3.24.4` to resolve vulnerability warnings.

[3.0.0-alpha.7]: https://github.com/AdguardTeam/tsurlfilter/releases/tag/dnr-rulesets-v3.0.0-alpha.7

## [3.0.0-alpha.3] - 2025-05-15

### Changed

- Updated `@adguard/tsurlfilter` to `3.3.1`.

[3.0.0-alpha.3]: https://github.com/AdguardTeam/tsurlfilter/releases/tag/dnr-rulesets-v3.0.0-alpha.3

## [3.0.0-alpha.0] - 2025-04-30

### Changed

- Updated `@adguard/tsurlfilter` to `3.3.0-alpha.0`.

### Removed

- Byte ranges from metadata ruleset.

[3.0.0-alpha.0]: https://github.com/AdguardTeam/tsurlfilter/releases/tag/dnr-rulesets-v3.0.0-alpha.0

## [2.0.0] - 2025-02-28

## Added

- [BREAKING] `unsafeRulesCount` in ruleset metadata to specify the number of unsafe rules in the ruleset.

### Changed

- Updated `@adguard/tsurlfilter` to `3.2.0-alpha.0`.

### Removed

- Text files from the build result. Now only JSON files are generated and they are including all the necessary data.
- `filters.json` from the build result. We embedded it to the metadata ruleset.

[2.0.0]: https://github.com/AdguardTeam/tsurlfilter/releases/tag/dnr-rulesets-v2.0.0

## [1.2.20240930132036] - 2024-09-30

### Added

- `Polish GDPR-Cookies Filters` [FiltersRegistry#1015].

[1.2.20240930132036]: https://github.com/AdguardTeam/tsurlfilter/releases/tag/dnr-rulesets-v1.2.20240930132036
[FiltersRegistry#1015]: https://github.com/AdguardTeam/FiltersRegistry/issues/1015

## 1.2.0 - 2024-09-05

### Changed

- Excluded `AdGuard Quick Fixes` with id 24 from the build.

## 1.1.0 - 2024-08-08

### Added

- New `ManifestPatcher.patch` method option `filtersMatch`
  to specify the filters matching glob pattern. default is `filter_+([0-9]).txt`.
- New CLI option `--filters-match` for customizing search pattern via `manifest` command.

### Fixed

- Download missed filters metadata files.

## 1.0.0 - 2024-08-06

### Added

- New library `RulesetsInjector` class for applying rulesets to the manifest object in the JS/TS code.
It will be useful for customizing the manifest object before saving it to the file.
For example, while bundling the manifest with the extension.
- Two new options for `manifest` CLI command:
    - `enable` option for specifying rulesets enabled by default
    - `ruleset-prefix` option for specifying the prefix for ruleset IDs.

### Changed

- [BREAKING] `patchManifest` library function replaced with `ManifestPatcher.patch` method. Now function is synchronous.
- [BREAKING] `loadAssets` library function replaced with `AssetsLoader.load` method.

## 0.1.0 - 2024-06-26

### Added

- New API for using library functionality in code.
- `--force-update` option for `manifest` command to overwrite existing rulesets.
- `--ids` option for `manifest` command to specify ruleset IDs to generate.

### Changed

- Improve filters compatibility with Declarative Net Request API.
