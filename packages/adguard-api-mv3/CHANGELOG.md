# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## Unreleased

### Added

- `adguardApi.onRequestBlocking` event data now contains `companyCategoryName` property for `$redirect` rules [#137].

[#137]: https://github.com/AdguardTeam/tsurlfilter/issues/137

## 0.1.7 - 2024-08-30

### Changed

- `adguardApi.onRequestBlocking` event data now contains `requestId` property
  and may contain `companyCategoryName` property which is a matched company name
  from `AdguardTeam/companiesdb` database in MV3.
  [List of tracker categories].

[List of tracker categories]: https://github.com/AdguardTeam/companiesdb/blob/main/README.md#tracker-categories

## 0.1.3 - 2024-07-29

### Changed

- Injection of the cosmetic rules is now done from the background page


## 0.1.0 - 2024-07-02

### Added

- New `adguardApi.onRequestBlocking` API for tracking blocked requests.
