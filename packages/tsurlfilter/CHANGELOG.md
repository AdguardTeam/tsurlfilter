# TSUrlFilter Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

<!-- TODO: manually add compare links for version changes -->
<!-- e.g. [1.0.77]: https://github.com/AdguardTeam/tsurlfilter/compare/tsurlfilter-v1.0.76...tsurlfilter-v1.0.77 -->

## Unreleased

### Added
- Ability to allowlist scriptlets by name [#377].

[#377]: https://github.com/AdguardTeam/Scriptlets/issues/377

## [2.2.19] - 2024-04-03

### Added

- Simple support of `$header` modifier — just for compiler validation.

[2.2.19]: https://github.com/AdguardTeam/tsurlfilter/releases/tag/tsurlfilter-v2.2.19

## [2.2.18] - 2024-03-29

### Fixed

- Do not block "Should collapse" mechanism with `$popup` rules.

[2.2.18]: https://github.com/AdguardTeam/tsurlfilter/releases/tag/tsurlfilter-v2.2.18


## [2.2.17] - 2024-03-28

### Changed

- Updated `@adguard/scriptlets` to `v1.10.25`.

[2.2.17]: https://github.com/AdguardTeam/tsurlfilter/releases/tag/tsurlfilter-v2.2.17


## [2.2.16] - 2024-03-28

### Fixed

- Correct work `$all` and `$popup` when they both selected for request [#2620], [#2728].

[2.2.16]: https://github.com/AdguardTeam/tsurlfilter/releases/tag/tsurlfilter-v2.2.16
[#2620]: https://github.com/AdguardTeam/AdguardBrowserExtension/issues/2620
[#2728]: https://github.com/AdguardTeam/AdguardBrowserExtension/issues/2728


## [2.2.15] - 2024-03-01

### Changed

- `$popup` should not disable simple blocking rule [#2728].

[2.2.15]: https://github.com/AdguardTeam/tsurlfilter/releases/tag/tsurlfilter-v2.2.15
[#2728]: https://github.com/AdguardTeam/AdguardBrowserExtension/issues/2728


## [2.2.14] - 2024-02-13

### Added

- New `BufferRuleList` class that is supposed to replace `StringRuleList`.
  It provides the same performance, but at the same time uses less memory
  as the original filter list is stored as a UTF-8 encoded byte array.
  In addition to that, it solves the problem of leaking links to the original leaking strings
  that in turn was leading to higher memory usage.

[2.2.14]: https://github.com/AdguardTeam/tsurlfilter/releases/tag/tsurlfilter-v2.2.14

## [2.2.13] - 2024-02-13

### Changed

- Updated `@adguard/scriptlets` to `v1.10.1`.

[2.2.13]: https://github.com/AdguardTeam/tsurlfilter/releases/tag/tsurlfilter-v2.2.13

## [2.2.12] - 2024-02-07

### Changed

- Priority calculation for `$popup` modifier [#2620].

[#2620]: https://github.com/AdguardTeam/AdguardBrowserExtension/issues/2620
[2.2.12]: https://github.com/AdguardTeam/tsurlfilter/releases/tag/tsurlfilter-v2.2.12

## [2.2.11] - 2024-01-25

### Changed

- Disable default support of newly added modifiers in MV3 converter.

[2.2.11]: https://github.com/AdguardTeam/tsurlfilter/releases/tag/tsurlfilter-v2.2.11

## [2.2.10] - 2024-01-09

### Added

- Export path for type declarations.

[2.2.10]: https://github.com/AdguardTeam/tsurlfilter/releases/tag/tsurlfilter-v2.2.10

## [2.2.9] - 2023-12-27

### Changed

- Updated `@adguard/scriptlets` to `v1.9.105`.

### Fixed

- Cosmetic rules with wildcard do not work on some domains [#2650].

[#2650]: https://github.com/AdguardTeam/AdguardBrowserExtension/issues/2650
[2.2.9]: https://github.com/AdguardTeam/tsurlfilter/releases/tag/tsurlfilter-v2.2.9

## [2.2.8] - 2023-12-07

### Added

- Library version number to the exports [#2237].

[#2237]: https://github.com/AdguardTeam/AdguardBrowserExtension/issues/2237
[2.2.8]: https://github.com/AdguardTeam/tsurlfilter/releases/tag/tsurlfilter-v2.2.8

## [2.2.7] - 2023-11-30

### Changed

- Updated `@adguard/scriptlets` to `v1.9.101`.

[2.2.7]: https://github.com/AdguardTeam/tsurlfilter/releases/tag/tsurlfilter-v2.2.7

## [2.2.6] - 2023-11-15

### Changed

- Updated `@adguard/scriptlets` to `v1.9.96`.

[2.2.6]: https://github.com/AdguardTeam/tsurlfilter/releases/tag/tsurlfilter-v2.2.6

## [2.2.5] - 2023-11-13

### Changed

- Updated `@adguard/scriptlets` to `v1.9.91`.

[2.2.5]: https://github.com/AdguardTeam/tsurlfilter/releases/tag/tsurlfilter-v2.2.5

## [2.2.4] - 2023-11-08

### Added

- Support of `$permissions` modifier for compiler validation
  [#66](https://github.com/AdguardTeam/tsurlfilter/issues/66)

[2.2.4]: https://github.com/AdguardTeam/tsurlfilter/releases/tag/tsurlfilter-v2.2.4

## [2.2.3] - 2023-11-03

### Added

- Support of `$referrerpolicy` modifier for compiler validation [#191].

[#191]: https://github.com/AdguardTeam/FiltersCompiler/issues/191

[2.2.3]: https://github.com/AdguardTeam/tsurlfilter/releases/tag/tsurlfilter-v2.2.3

## [2.2.2] - 2023-10-17

### Fixed

- Added all resource types for $removeparam [#49].

[#49]: https://github.com/AdguardTeam/AdGuardMV3/issues/49

[2.2.2]: https://github.com/AdguardTeam/tsurlfilter/releases/tag/tsurlfilter-v2.2.2

## [2.2.1] - 2023-10-13

### Changed

- Updated `@adguard/scriptlets` to `v1.9.83`.

[2.2.1]: https://github.com/AdguardTeam/tsurlfilter/releases/tag/tsurlfilter-v2.2.1

## [2.2.0] - 2023-10-12

### Added

- Support for $badfilter rules to Declarative Converter.

[2.2.0]: https://github.com/AdguardTeam/tsurlfilter/releases/tag/tsurlfilter-v2.2.0

## [2.1.12] - 2023-09-25

### Fixed

- Scriptlets not being logged when filtering log is open [#2481].
- Filtering log clearing on `$removeparam` rule application [#2442].

[#2481]: https://github.com/AdguardTeam/AdguardBrowserExtension/issues/2481
[#2442]: https://github.com/AdguardTeam/AdguardBrowserExtension/issues/2442

[2.1.12]: https://github.com/AdguardTeam/tsurlfilter/releases/tag/tsurlfilter-v2.1.12

## [2.1.11] - 2023-08-25

### Changed

- Updated `@adguard/scriptlets` to `v1.9.72`.

[2.1.11]: https://github.com/AdguardTeam/tsurlfilter/releases/tag/tsurlfilter-v2.1.11

## [2.1.10] - 2023-08-21

### Changed

- Updated `@adguard/scriptlets` to `v1.9.70`.

[2.1.10]: https://github.com/AdguardTeam/tsurlfilter/releases/tag/tsurlfilter-v2.1.10

## [2.1.9] - 2023-08-18

### Added

- Added `CspReport` to RequestType enum.

[2.1.9]: https://github.com/AdguardTeam/tsurlfilter/releases/tag/tsurlfilter-v2.1.9

## [2.1.8] - 2023-08-14

### Fixed

- Crash on converting allowlist csp rules.

[2.1.8]: https://github.com/AdguardTeam/tsurlfilter/releases/tag/tsurlfilter-v2.1.8

## [2.1.7] - 2023-08-10

### Added

- Support for `$to` modifier in the MV3 converter.
- Support for `$method` modifier in the MV3 converter.

### Changed

- Replace the `ip6addr` and `netmask` dependencies with the platform-independent
  `cidr-tool`.
- Remove Node Api polyfills from the bundle.

### Fixed

- Bad conversion of `allowAllRequests` rules.

[2.1.7]: https://github.com/AdguardTeam/tsurlfilter/releases/tag/tsurlfilter-v2.1.7

## [2.1.6] - 2023-08-04

### Changed

- Updated `@adguard/scriptlets` to `v1.9.62`.
- Esm module now imports external dependencies instead of bundling.

[2.1.6]: https://github.com/AdguardTeam/tsurlfilter/releases/tag/tsurlfilter-v2.1.6

## [2.1.5] - 2023-07-21

### Changed

- Updated `@adguard/scriptlets` to `v1.9.57`.

[2.1.5]: https://github.com/AdguardTeam/tsurlfilter/releases/tag/tsurlfilter-v2.1.5

## [2.1.4] - 2023-07-13

### Added

- Support for `$csp` modifier in the MV3 converter.
- Scheme for converting network rules into declarative rules.

### Changed

- Converting rules in MV3 with these modifiers `$elemhide`, `$specifichide`
  and `$generichide` now does not cause any errors and is simply skipped.

### Fixed

- Matching result caching for rules with `$method` modifier

[2.1.4]: https://github.com/AdguardTeam/tsurlfilter/releases/tag/tsurlfilter-v2.1.4

## [2.1.3] - 2023-06-26

### Added

- New `$to` modifier to match requests by target domains and subdomains.
- In the MV3 declarative converter, the obsolete `$mp4` and `$empty` are now
  converted by replacing them with `$redirect` rules.
- Support for $removeheader modifier in the MV3 converter.

### Fixed

- Rule converter incorrectly converting network rules with regexp.

[2.1.3]: https://github.com/AdguardTeam/tsurlfilter/releases/tag/tsurlfilter-v2.1.3

## [2.1.2] - 2023-06-19

### Fixed

- Unwanted escape character removal when running `RuleConverter.convertRule()`
  on rules with regexp-value modifiers.

[2.1.2]: https://github.com/AdguardTeam/tsurlfilter/releases/tag/tsurlfilter-v2.1.2

## [2.1.1] - 2023-06-16

### Added

- New `$method` modifier to match requests by HTTP method.
- New `NetworkRule` method `isFilteringDisabled` to check if rule is completely
  disabled filtering.

[2.1.1]: https://github.com/AdguardTeam/tsurlfilter/releases/tag/tsurlfilter-v2.1.1

## [2.1.0] - 2023-06-14

### Changed

- The algorithm of priority calculation: adding more accurate calculation
  of weights for each rule type - more details in [#196].
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

[#196]: https://github.com/AdguardTeam/KnowledgeBase/pull/196

[2.1.0]: https://github.com/AdguardTeam/tsurlfilter/releases/tag/tsurlfilter-v2.1.0

## [2.0.7] - 2023-06-14

### Fixed

- Do not remove escape characters from regexp modifiers values during
  `RuleConverter.convertRule()`.

[2.0.7]: https://github.com/AdguardTeam/tsurlfilter/releases/tag/tsurlfilter-v2.0.7

## [2.0.6] - 2023-06-06

### Changed

- Updated `@adguard/scriptlets` to `v1.9.37`

### Fixed

- Domain matching for wildcard tld in rules

[2.0.6]: https://github.com/AdguardTeam/tsurlfilter/releases/tag/tsurlfilter-v2.0.6

## [2.0.5] - 2023-04-24

### Changed

- RuleConverter speed has been improved by 2x [#83].
- Declarative converter build has been separated from the main package.

[#83]: https://github.com/AdguardTeam/tsurlfilter/issues/83

[2.0.5]: https://github.com/AdguardTeam/tsurlfilter/releases/tag/tsurlfilter-v2.0.5

<!-- 2.0.4 is the same as 2.0.3, no difference -->

## [2.0.3] - 2023-04-17

### Fixed

- `require` export of `umd`.

[2.0.3]: https://github.com/AdguardTeam/tsurlfilter/releases/tag/tsurlfilter-v2.0.3

## [2.0.2] - 2023-04-17

### Changed

- Updated `@adguard/scriptlets` to `v1.9.7`

[2.0.2]: https://github.com/AdguardTeam/tsurlfilter/releases/tag/tsurlfilter-v2.0.2

## [2.0.1] - 2023-03-31

### Added

- New `DeclarativeConverter` API that provides functionality for converting AG
  rules to MV3 declarative syntax.
- New `@adguard/tsurlfilter/cli` tool for compiling filter lists into
  declarative MV3 rules from the terminal.

### Removed

- Removed `ContentFilter`, `ContentFiltering`, `ModificationsListener`,
  `RequestContext`, `ExtendedCss`, `CssHitsCounter`, `CookieController`,
  `StealthHelper`, `CookieFiltering`, `HeadersService` classes.
  The provided functionality is now available in the new
  `@adguard/tswebextension` package.
- Removed `TSUrlFilterContentScript` API. Now content script is implemented in
  the `@adguard/tswebextension` package.

[2.0.1]: https://github.com/AdguardTeam/tsurlfilter/releases/tag/tsurlfilter-v2.0.1

## [2.0.0-alpha.49] - 2023-03-14

### Changed

- Updated Scriptlets to v1.9.1

[2.0.0-alpha.49]: https://github.com/AdguardTeam/tsurlfilter/releases/tag/tsurlfilter-v2.0.0-alpha.49

## [2.0.0-alpha.47]  - 2023-01-20

### Changed

- The enum RequestType is made as const to avoid side effects for tree shaking.

[2.0.0-alpha.47]: https://github.com/AdguardTeam/tsurlfilter/releases/tag/tsurlfilter-v2.0.0-alpha.47

## [2.0.0-alpha.35] - 2022-12-23

### Removed

- Support of `$webrtc` modifier.

[2.0.0-alpha.35]: https://github.com/AdguardTeam/tsurlfilter/releases/tag/tsurlfilter-v2.0.0-alpha.35

## [1.0.77] - 2023-03-10

### Changed

- Updated Scriptlets to v1.9.1

[1.0.77]: https://github.com/AdguardTeam/tsurlfilter/releases/tag/tsurlfilter-v1.0.77

## [1.0.76] - 2023-03-01

### Fixed

- Avoid cases where two `CssHitsCounter`s try to append and remove the same
  elements one after another.

[1.0.76]: https://github.com/AdguardTeam/tsurlfilter/releases/tag/tsurlfilter-v1.0.76

## [1.0.75] - 2023-02-17

### Changed

- Updated ExtendedCss to v2.0.51

[1.0.75]: https://github.com/AdguardTeam/tsurlfilter/releases/tag/tsurlfilter-v1.0.75

## [1.0.74] - 2023-02-07

### Changed

- Updated ExtendedCss to v2.0.49

[1.0.74]: https://github.com/AdguardTeam/tsurlfilter/releases/tag/tsurlfilter-v1.0.74

## [1.0.73] - 2023-02-01

### Changed

- Updated ExtendedCss to v2.0.45

[1.0.73]: https://github.com/AdguardTeam/tsurlfilter/releases/tag/tsurlfilter-v1.0.73

## [1.0.70] - 2023-01-19

### Changed

- Updated Scriptlets to v1.8.2

[1.0.70]: https://github.com/AdguardTeam/tsurlfilter/releases/tag/tsurlfilter-v1.0.70

## [1.0.68] - 2022-12-28

### Added

- Simple support of `$hls` modifier — just for compiler validation

### Changed

- Removed unnecessary brackets for unknown pseudo-class validation error

[1.0.68]: https://github.com/AdguardTeam/tsurlfilter/releases/tag/tsurlfilter-v1.0.68

## [1.0.67] - 2022-12-27

### Added

- Simple support of `$jsonprune` modifier — just for compiler validation

### Changed

- Improved selector validation unknown pseudo-class error

[1.0.67]: https://github.com/AdguardTeam/tsurlfilter/releases/tag/tsurlfilter-v1.0.67

## [1.0.66] - 2022-12-23

### Removed

- Support of $webrtc modifier

[1.0.66]: https://github.com/AdguardTeam/tsurlfilter/releases/tag/tsurlfilter-v1.0.66

## [1.0.65] - 2022-12-22

### Changed

- Updated ExtendedCss to v2.0.33
- Updated Scriptlets to v1.7.19

[1.0.65]: https://github.com/AdguardTeam/tsurlfilter/releases/tag/tsurlfilter-v1.0.65

## [1.0.64] - 2022-12-16

### Changed

- Updated Scriptlets to v1.7.14

[1.0.64]: https://github.com/AdguardTeam/tsurlfilter/releases/tag/tsurlfilter-v1.0.64

## [1.0.63] - 2022-12-13

### Changed

- Updated Scriptlets to v1.7.13

[1.0.63]: https://github.com/AdguardTeam/tsurlfilter/releases/tag/tsurlfilter-v1.0.63

## [1.0.62] -  2022-12-12

### Changed

- Always consider `:has()` pseudo-class as extended

[1.0.62]: https://github.com/AdguardTeam/tsurlfilter/releases/tag/tsurlfilter-v1.0.62

## [1.0.59] - 2022-12-08

### Changed

- Updated ExtendedCss to v2.0.26

[1.0.59]: https://github.com/AdguardTeam/tsurlfilter/releases/tag/tsurlfilter-v1.0.59

## [1.0.57] - 2022-12-06

### Changed

- Updated ExtendedCss to v2.0.24
- Updated Scriptlets to v1.7.10

### Removed

- `:if()` and `:if-not()` pseudo-classes

[1.0.57]: https://github.com/AdguardTeam/tsurlfilter/releases/tag/tsurlfilter-v1.0.57
