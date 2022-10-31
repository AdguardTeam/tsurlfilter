# Changelog
All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.0] - 2022-10-31
### Added
- `adguardApi.getRulesCount` method for getting current loaded rules count
- Api can be imported as npm module
- Typescript support

### Changed
- Optional callback param was removed from `adguardApi.start`, `adguardApi.stop` and `adguardApi.configure` in favor of promises usage

