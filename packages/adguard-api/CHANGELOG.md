# Changelog
All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).
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

