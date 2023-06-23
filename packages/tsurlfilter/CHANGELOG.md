# TSUrlFilter Changelog

All notable changes to this project will be documented in this file.
The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).


<!-- TODO: manually add compare links for version to the end of the file -->
<!-- e.g. [1.0.77]: https://github.com/AdguardTeam/tsurlfilter/compare/tsurlfilter-v1.0.76...tsurlfilter-v1.0.77 -->

## Unreleased

### Added
- New `$to` modifier to match requests by target domains and subdomains.
- In the MV3 declarative converter, the obsolete `$mp4` and `$empty` are now
  converted by replacing them with `$redirect` rules.

## [2.1.2] - 2023-06-19

### Fixed

- unwanted escape character removal when running `RuleConverter.convertRule()` on rules with regexp-value modifiers

## [2.1.1] - 2023-06-16

### Added

- new `$method` modifier to match requests by HTTP method.
- new `NetworkRule` method `isFilteringDisabled` to check if rule is completely disabled filtering.


## [2.1.0] - 2023-06-14

### Changed

- The algorithm of priority calculation: adding more accurate calculation
  of weights for each rule type - more details here
  https://github.com/AdguardTeam/KnowledgeBase/pull/196.
- `$all` modifier is one NetworkRule rule with all included options.
- Removed `$csp` modifier from `$all` (`$inline-font` and `$inline-script`).
- `$document` in blocking rule now just puts content-type: document (main_frame).
- Exception with `$document` modifier, for example in rule
  `@@||example.com^$document` is an alias for
  `$content,jsinject,elemhide,urlblock`.
  In all other cases, `$document` is treated as a regular content-type modifier.
- Exceptions with `$urlblock` disables `$cookie` rules.
- `$redirect` rules are higher in priority than blocking rules.
- Exceptions are higher in priority than `$redirect` and blocking rules.
- `$important` is higher than all others.


## [2.0.7] - 2023-06-14

### Fixed

- Do not remove escape characters from regexp modifiers values during `RuleConverter.convertRule()`


## [2.0.6] - 2023-06-06

### Changed

- Updated `@adguard/scriptlets` to `v1.9.37`

### Fixed

- Domain matching for wildcard tld in rules


## [2.0.5] - 2023-04-24

### Changed

- RuleConverter speed has been improved by 2x [#83](https://github.com/AdguardTeam/tsurlfilter/issues/83)
- Declarative converter build has been separated from the main package


<!-- 2.0.4 is the same as 2.0.3, no difference -->


## [2.0.3] - 2023-04-17

### Fixed

- `require` export of `umd`


## [2.0.2] - 2023-04-17

### Changed

- Updated `@adguard/scriptlets` to `v1.9.7`


## [2.0.1] - 2023-03-31

### Added

- New `DeclarativeConverter` API that provides functionality for converting AG rules to MV3 declarative syntax.
- New `@adguard/tsurlfilter/cli` tool for compiling filter lists into declarative MV3 rules from the terminal.

### Removed

- Removed `ContentFilter`, `ContentFiltering`, `ModificationsListener`, `RequestContext`, `ExtendedCss`, `CssHitsCounter`, `CookieController`, `StealthHelper`, `CookieFiltering`, `HeadersService` classes. The provided functionality is now available in the `@adguard/tswebextension` package.
- Removed `TSUrlFilterContentScript` API. Now content script is implemented in the `@adguard/tswebextension` package.


## [2.0.0-alpha.49] - 2023-03-14

### Changed

- Updated Scriptlets to v1.9.1

## [2.0.0-alpha.47]  - 2023-01-20

### Changed

- The enum RequestType is made as const to avoid side effects for tree shaking.


## [2.0.0-alpha.35] - 2022-12-23

### Removed

- Support of $webrtc modifier


## [1.0.77] - 2023-03-10

### Changed

- Updated Scriptlets to v1.9.1


## [1.0.76] - 2023-03-01

### Fixed

- Avoid cases where two `CssHitsCounter`s try to append and remove the same elements one after another


## [1.0.75] - 2023-02-17

### Changed

- Updated ExtendedCss to v2.0.51


## [1.0.74] - 2023-02-07

### Changed

- Updated ExtendedCss to v2.0.49


## [1.0.73] - 2023-02-01

### Changed

- Updated ExtendedCss to v2.0.45


## [1.0.70] - 2023-01-19

### Changed

- Updated Scriptlets to v1.8.2


## [1.0.68] - 2022-12-28

### Added

- Simple support of `$hls` modifier — just for compiler validation

### Changed

- Removed unnecessary brackets for unknown pseudo-class validation error


## [1.0.67] - 2022-12-27

### Added

- Simple support of `$jsonprune` modifier — just for compiler validation

### Changed

- Improved selector validation unknown pseudo-class error


## [1.0.66] - 2022-12-23

### Removed

- Support of $webrtc modifier


## [1.0.65] - 2022-12-22

### Changed

- Updated ExtendedCss to v2.0.33
- Updated Scriptlets to v1.7.19


## [1.0.64] - 2022-12-16

### Changed

- Updated Scriptlets to v1.7.14


## [1.0.63] - 2022-12-13

### Changed

- Updated Scriptlets to v1.7.13


## [1.0.62] -  2022-12-12

### Changed

- Always consider `:has()` pseudo-class as extended


## [1.0.59] - 2022-12-08

### Changed

- Updated ExtendedCss to v2.0.26


## [1.0.57] - 2022-12-06

### Changed

- Updated ExtendedCss to v2.0.24
- Updated Scriptlets to v1.7.10

### Removed

- `:if()` and `:if-not()` pseudo-classes
