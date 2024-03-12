# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [2.1.1] - 2023-12-01

### Added
- [BREAKING CHANGE] New mandatory `filteringEnabled` configuration option that allows you to enable/disable filtering engine.
- New `setFilteringEnabled` method that allows you to enable/disable filtering engine without engine re-initialization. See [documentation](README.md#setfilteringenabled) for details.

### Changed
- [BREAKING CHANGE] `AdguardApi.create` returns Promise.

## [2.0.1] - 2023-11-29

## Added

- New `adguardApi.getHandlerMessage` method that returns the API message handler.
- New `documentBlockingPageUrl` configuration option that allows you to specify a URL to the document blocking page. See [documentation](README.md#configuration) for details.

### Changed

- [BREAKING CHANGE] The API message listener is no longer initialized on API startup. Now you can use the `adguardApi.getHandlerMessage` method to get it and manually route messages to both the API and your application. See example in the [documentation](README.md#adguardapigetmessagehandler).
- [BREAKING CHANGE] Drop support for UMD modules. Now only ESM is provided.
- Update `@adguard/tswebextension` to `v0.4.8`.
- Update `@adguard/filters-downloader` to `v1.1.23`.


### Removed

- [BREAKING CHANGE] Pre-build js bundles.

### Fixed

- Fix missing type declarations.


## [1.3.4] - 2023-09-27

### Changed

- Update `@adguard/tswebextension` to `v0.3.21`


## [1.3.3] - 2023-09-13

### Changed

- Update `@adguard/tswebextension` to `v0.3.17`


## [1.3.2] - 2023-09-08

### Changed
- Update `@adguard/tswebextension` to `v0.3.16`


## [1.3.1] - 2023-08-18

### Changed
- Update `@adguard/tswebextension` to `v0.3.10`


## [1.3.0] - 2023-08-10
### Changed
- [BREAKING CHANGE] Assistant script is separated and dynamically injected. You need to provide it in your project.
- Update `@adguard/tswebextension` to `v0.3.9`
- Update `@adguard/assistant` to `v4.3.70`


## [1.2.2] - 2022-12-02
### Added
- Add source maps for bundles

### Changed
- Fix filter version comparison bug


## [1.2.0] - 2022-11-25
### Added
- `AdguardApi.create` static method for creating new `AdguardApi` instance.

### Changed

- [BREAKING CHANGE] Global `adguardApi` instance was deleted. Export `AdguardApi` class instead and create new instance by `AdguardApi.create` static method


## [1.1.0] - 2022-11-12

### Changed
- Add js rules execution guard for firefox


## [1.0.0] - 2022-11-03
### Added
- `adguardApi.getRulesCount` method for getting the number of rules that are currently loaded into the filtering engine
- `adguardApi.onAssistantCreateRule` API for tracking Assistant rule apply
- Typescript support
- Adguard Api can be imported as an npm module

### Changed
- [BREAKING CHANGE] Optional callback param was removed from `adguardApi.start`, `adguardApi.stop` and `adguardApi.configure` in favor of promises usage
- [BREAKING CHANGE] rename API configuration fields:
  - whitelist -> allowlist
  - blacklist -> blocklist
- [BREAKING CHANGE] - remove `adguardApi.getAssistantToken`
