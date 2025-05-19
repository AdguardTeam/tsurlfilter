# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## Unreleased

### Changed

<!-- TODO: Specify version before release -->
- Updated [@adguard/tswebextension] to `^3.x.x`.

### Fixed

- Updated `zod` dependency to version `3.24.4` to resolve vulnerability warnings.

## [3.0.3] - 2024-11-22

### Changed

- Updated [@adguard/tswebextension] to `^2.0.7`.

[3.0.3]: https://github.com/AdguardTeam/tsurlfilter/releases/tag/adguard-api-v3.0.3

## [3.0.2] - 2024-10-14

### Changed

- Updated [@adguard/tswebextension] to `^2.0.3`.

[3.0.2]: https://github.com/AdguardTeam/tsurlfilter/releases/tag/adguard-api-v3.0.2

## [3.0.1] - 2024-08-28

### Changed

- Updated [@adguard/tswebextension] to `v2.0.1`.

[3.0.1]: https://github.com/AdguardTeam/tsurlfilter/releases/tag/adguard-api-v3.0.1

## [3.0.0] - 2024-08-15

### Changed

- Updated [@adguard/tswebextension] to `v2.0.0`.
- `adguardApi.onRequestBlocking` event data now contains `requestId` property.
- Filter lists are now stored in a pre-processed format, which makes the engine start more efficiently,
  since the engine does not need to convert or parse the rules.

[3.0.0]: https://github.com/AdguardTeam/tsurlfilter/releases/tag/adguard-api-v3.0.0

## [2.1.5] - 2024-07-17

### Fixed

- `listId` -1 not found in the storage.

### Changed

- Updated [@adguard/tswebextension] to `v1.0.30`.

[2.1.5]: https://github.com/AdguardTeam/tsurlfilter/releases/tag/adguard-api-v2.1.5

## [2.1.4] - 2024-04-02

### Changed

- Updated [@adguard/tswebextension] to `v1.0.22`.
- Updated [@adguard/filters-downloader] to `v2.2.0`.

[2.1.4]: https://github.com/AdguardTeam/tsurlfilter/releases/tag/adguard-api-v2.1.4

## [2.1.3] - 2024-02-15

### Changed

- Updated [@adguard/tswebextension] to `v1.0.14`.

[2.1.3]: https://github.com/AdguardTeam/tsurlfilter/releases/tag/adguard-api-v2.1.3

## [2.1.2] - 2024-02-08

### Added

- New private method `removeObsoletedFilters` to prevent usage of obsoleted filters.
- New public event channel `AdguardApi.onFiltersDeletion`.

### Changed

- `adguardApi.start` returns Promise with applied configuration with already removed
obsoleted filters ids.

[2.1.2]: https://github.com/AdguardTeam/tsurlfilter/releases/tag/adguard-api-v2.1.2

## [2.1.1] - 2023-12-01

### Added

- [BREAKING CHANGE] New mandatory `filteringEnabled` configuration option
  that allows you to enable/disable filtering engine.
- New `setFilteringEnabled` method that allows you to enable/disable filtering engine without engine re-initialization.
  See [documentation](README.md#setfilteringenabled) for details.

### Changed

- [BREAKING CHANGE] `AdguardApi.create` returns Promise.

[2.1.1]: https://github.com/AdguardTeam/tsurlfilter/releases/tag/adguard-api-v2.1.1

## [2.0.1] - 2023-11-29

## Added

- New `adguardApi.getHandlerMessage` method that returns the API message handler.
- New `documentBlockingPageUrl` configuration option that allows you to specify a URL to the document blocking page.
  See [documentation](README.md#configuration) for details.

### Changed

- [BREAKING CHANGE] The API message listener is no longer initialized on API startup.
  Now you can use the `adguardApi.getHandlerMessage` method to get it and manually route messages to both the API
  and your application. See example in the [documentation](README.md#adguardapigetmessagehandler).
- [BREAKING CHANGE] Drop support for UMD modules. Now only ESM is provided.
- Updated [@adguard/tswebextension] to `v0.4.8`.
- Updated [@adguard/filters-downloader] to `v1.1.23`.

### Removed

- [BREAKING CHANGE] Pre-build js bundles.

### Fixed

- Fix missing type declarations.

[2.0.1]: https://github.com/AdguardTeam/tsurlfilter/releases/tag/adguard-api-v2.0.1

## [1.3.4] - 2023-09-27

### Changed

- Updated [@adguard/tswebextension] to `v0.3.21`.

[1.3.4]: https://github.com/AdguardTeam/tsurlfilter/releases/tag/adguard-api-v1.3.4

## [1.3.3] - 2023-09-13

### Changed

- Updated [@adguard/tswebextension] to `v0.3.17`.

[1.3.3]: https://github.com/AdguardTeam/tsurlfilter/releases/tag/adguard-api-v1.3.3

## [1.3.2] - 2023-09-08

### Changed

- Updated [@adguard/tswebextension] to `v0.3.16`.

[1.3.2]: https://github.com/AdguardTeam/tsurlfilter/releases/tag/adguard-api-v1.3.2

## [1.3.1] - 2023-08-18

### Changed

- Updated [@adguard/tswebextension] to `v0.3.10`.

[1.3.1]: https://github.com/AdguardTeam/tsurlfilter/releases/tag/adguard-api-v1.3.1

## [1.3.0] - 2023-08-10

### Changed

- [BREAKING CHANGE] Assistant script is separated and dynamically injected. You need to provide it in your project.
- Updated [@adguard/tswebextension] to `v0.3.9`.
- Updated [@adguard/assistant] to `v4.3.70`.

[1.3.0]: https://github.com/AdguardTeam/tsurlfilter/releases/tag/adguard-api-v1.3.0

## [1.2.2] - 2022-12-02

### Added

- Add source maps for bundles.

### Changed

- Fix filter version comparison bug.

[1.2.2]: https://github.com/AdguardTeam/tsurlfilter/releases/tag/adguard-api-v1.2.2

## [1.2.0] - 2022-11-25

### Added

- `AdguardApi.create` static method for creating new `AdguardApi` instance.

### Changed

- [BREAKING CHANGE] Global `adguardApi` instance was deleted.
  Export `AdguardApi` class instead and create new instance by `AdguardApi.create` static method.

[1.2.0]: https://github.com/AdguardTeam/tsurlfilter/releases/tag/adguard-api-v1.2.0

## 1.1.0 - 2022-11-12

### Changed

- Add JS rules execution guard for Firefox.

## 1.0.0 - 2022-11-03

### Added

- `adguardApi.getRulesCount` method for getting the number of rules that are currently loaded into the filtering engine.
- `adguardApi.onAssistantCreateRule` API for tracking Assistant rule apply.
- Typescript support.
- Adguard Api can be imported as an npm module.

### Changed

- [BREAKING CHANGE] rename API configuration fields:
    - whitelist -> allowlist
    - blacklist -> blocklist.

### Removed

- [BREAKING CHANGE] Optional callback param from `adguardApi.start`, `adguardApi.stop`
  and `adguardApi.configure` in favor of promises usage.
- [BREAKING CHANGE] No more `adguardApi.getAssistantToken`.

[@adguard/tswebextension]: ../tswebextension/CHANGELOG.md

[@adguard/assistant]: https://github.com/AdguardTeam/AdguardAssistant/blob/master/CHANGELOG.md
[@adguard/filters-downloader]: https://github.com/AdguardTeam/FiltersDownloader/blob/master/CHANGELOG.md
