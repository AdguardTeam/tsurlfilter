# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.2.0] - 2024-09-05

### Changed

- Excluded AdGuard Quick Fixes with id 24 from the build.


## [1.1.0] - 2024-08-08

### Added

- New `ManifestPatcher.patch` method option `filtersMatch` to specify the filters matching glob pattern. default is `filter_+([0-9]).txt`.
- New CLI option `--filters-match` for customizing search pattern via `manifest` command.

### Fixed

- Download missed filters metadata files.


## [1.0.0] - 2024-08-06

### Added
- New library `RulesetsInjector` class for applying rulesets to the manifest object in the JS/TS code.
It will be useful for customizing the manifest object before saving it to the file.
For example, while bundling the manifest with the extension.
- Two new options for `manifest` CLI command
  - `enable` option for specifying rulesets enabled by default.
  - `ruleset-prefix` option for specifying the prefix for ruleset IDs.

### Changed
- [BREAKING] `patchManifest` library function replaced with `ManifestPatcher.patch` method. Now function is synchronous.
- [BREAKING] `loadAssets` library function replaced with `AssetsLoader.load` method.


## [0.1.0] - 2024-06-26

### Added
- New API for using library functionality in code.
- `--force-update` option for `manifest` command to overwrite existing rulesets.
- `--ids` option for `manifest` command to specify ruleset IDs to generate.

### Changed
- Improve filters compatibility with Declarative Net Request API.
