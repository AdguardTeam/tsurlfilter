# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## 0.2.3 - 2024-11-22

### Changed

- Updated [@adguard/tswebextension] to `v2.4.0-alpha.7`.

## 0.2.1 - 2024-10-15

### Changed

- Updated [@adguard/logger] to `v1.1.0`.
- Updated [@adguard/tswebextension] to `v2.4.0-alpha.3`.

### Fixed

- MV3 extension cannot apply rules to `about:blank` iframes [AdguardBrowserExtension#2975].
- JS rules are blocked by Trusted Types on some websites [AdguardBrowserExtension#2980].
- Scriptlets logging does not work [AdguardBrowserExtension#2977].

[AdguardBrowserExtension#2975]: https://github.com/AdguardTeam/AdguardBrowserExtension/issues/2975
[AdguardBrowserExtension#2977]: https://github.com/AdguardTeam/AdguardBrowserExtension/issues/2977
[AdguardBrowserExtension#2980]: https://github.com/AdguardTeam/AdguardBrowserExtension/issues/2980

## 0.2.0 - 2024-10-02

### Changed

- Path to web accessible resources changed from `/adguard/redirects` to
  `/web-accessible-resources/redirects` for correct work of `@adguard/dnr-rulesets`.
- Updated [@adguard/logger] to `v1.0.2`.
- Updated [@adguard/tswebextension] to `v2.3.0-alpha.1`.

### Added

- `adguardApi.onRequestBlocking` event data now contains `companyCategoryName` property for `$redirect` rules [#137].

### Fixed

- Logging of `adguardApi.onRequestBlocking` events which are falsely considered as blocked requests.

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

- Injection of the cosmetic rules is now done from the background page/

## 0.1.0 - 2024-07-02

### Added

- New `adguardApi.onRequestBlocking` API for tracking blocked requests.

[@adguard/logger]: ../logger/CHANGELOG.md
[@adguard/tswebextension]: ../tswebextension/CHANGELOG.md
