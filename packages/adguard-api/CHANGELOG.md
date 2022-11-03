# Changelog
All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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

