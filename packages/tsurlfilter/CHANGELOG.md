# TSUrlFilter Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [3.3.3] - 2025-05-22

### Changed

- Updated [@adguard/agtree] to `v3.2.0`.

### Fixed

- Internal code for source rule finding from rulesets.

[3.3.3]: https://github.com/AdguardTeam/tsurlfilter/releases/tag/tsurlfilter-v3.3.3

## [3.3.2] - 2025-05-19

### Changed

- Updated [@adguard/agtree] to `v3.1.4`.

### Fixed

- Updated `zod` dependency to version `3.24.4` to resolve vulnerability warnings.

[3.3.2]: https://github.com/AdguardTeam/tsurlfilter/releases/tag/tsurlfilter-v3.3.2

## [3.3.1] - 2025-05-15

### Changed

- DNR converter now keep IDs of converted rules the same between launches
  if text of the rule is the same.

[3.3.1]: https://github.com/AdguardTeam/tsurlfilter/releases/tag/tsurlfilter-v3.3.1

## [3.3.0-alpha.0] - 2025-04-30

### Changed

- Updated [@adguard/agtree] to `v3.1.3`.

### Removed

- Byte ranges management for rulesets.

[3.3.0-alpha.0]: https://github.com/AdguardTeam/tsurlfilter/releases/tag/tsurlfilter-v3.3.0-alpha.0

## [3.2.3] - 2025-04-15

### Fixed

- `fetchExtensionResourceText` util — enforce min byte range length when fetching resources
  [AdguardBrowserExtension#3128].

[3.2.3]: https://github.com/AdguardTeam/tsurlfilter/releases/tag/tsurlfilter-v3.2.3
[AdguardBrowserExtension#3128]: https://github.com/AdguardTeam/AdguardBrowserExtension/issues/3128

## [3.2.2] - 2025-03-31

### Changed

- Updated [@adguard/agtree] to `v3.1.0`.

[3.2.2]: https://github.com/AdguardTeam/tsurlfilter/releases/tag/tsurlfilter-v3.2.2

## [3.2.1] - 2025-03-06

### Changed

- Updated [@adguard/scriptlets] to `v2.1.6`.

[3.2.1]: https://github.com/AdguardTeam/tsurlfilter/releases/tag/tsurlfilter-v3.2.1

## [3.2.0] - 2025-02-28

### Added

- Unload methods for `RuleSet` and `Filter` in the declarative converter.
- `retrieveRuleNode` method to `Engine` class for retrieving rule nodes by their filter id and index.

### Changed

- Updated [@adguard/agtree] to `v3.0.1`.
- Updated [@adguard/scriptlets] to `v2.1.5`.

### Fixed

- Reworked the shortcut extractor for regular expressions. It now correctly handles disjunctions,
  named groups, character classes, and other complex patterns. [AdguardBrowserExtension#3105].

[3.2.0]: https://github.com/AdguardTeam/tsurlfilter/releases/tag/tsurlfilter-v3.2.0
[AdguardBrowserExtension#3105]: https://github.com/AdguardTeam/AdguardBrowserExtension/issues/3105

## [3.1.0-alpha.8] - 2025-01-30

### Added

- Metadata declarative rule to hold additional information about the filter list.
  It is a special rule at the beginning of the ruleset that contains metadata, e.g.
  raw filter list rules, declarative metadata, lazy metadata, conversion map, source map, etc.
- Byte range maps. This feature allows retrieving only specific parts of the ruleset `.json` file, saving memory
  and improving performance.
- Optional property `maxNumberOfUnsafeRules` to `DeclarativeConverterOptions`
  for unsafe rules (only for dynamic rulesets).

### Changed

- Drop UMD support, now only ESM builds.
- Updated [@adguard/agtree] to `v3.0.0-alpha.3` which improves the bundle size
  and performance.
- Updated [@adguard/scriptlets] to `v2.1.4` which improves the bundle size and
  performance.

### Fixed

- URI encoded `$removeparam` value is not removed in MV3 [AdguardBrowserExtension#3014].
- `$removeparam` fails to match encoded URL params in MV2 [AdguardBrowserExtension#3015].
- `$popup,third-party` modifiers cause document blocking [AdguardBrowserExtension#3012].
- `$removeparam` incorrectly removes parameters from encoded URLs [AdguardBrowserExtension#3076].
- Pattern shortcut extraction from regexp patterns with character classes [AdguardBrowserExtension#2924].

[3.1.0-alpha.8]: https://github.com/AdguardTeam/tsurlfilter/releases/tag/tsurlfilter-v3.1.0-alpha.8
[AdguardBrowserExtension#3014]: https://github.com/AdguardTeam/AdguardBrowserExtension/issues/3014
[AdguardBrowserExtension#3012]: https://github.com/AdguardTeam/AdguardBrowserExtension/issues/3012
[AdguardBrowserExtension#3076]: https://github.com/AdguardTeam/AdguardBrowserExtension/issues/3076
[AdguardBrowserExtension#2924]: https://github.com/AdguardTeam/AdguardBrowserExtension/issues/2924

## [3.0.8] - 2024-11-25

### Changed

- Error throwing for empty modifier list in network rules.
- Updated `@adguard/agtree` to `v2.1.4`.

### Fixed

- Handling missing children data in the deserializer for certain nodes.

[3.0.8]: https://github.com/AdguardTeam/tsurlfilter/releases/tag/tsurlfilter-v3.0.8

## [3.0.7] - 2024-11-19

### Fixed

- `$removeparam` fails to match encoded URL params in MV2 [AdguardBrowserExtension#3015].

[AdguardBrowserExtension#3015]: https://github.com/AdguardTeam/AdguardBrowserExtension/issues/3015
[3.0.7]: https://github.com/AdguardTeam/tsurlfilter/releases/tag/tsurlfilter-v3.0.7

## [3.0.6] - 2024-11-02

### Changed

- Updated `@adguard/agtree` to `v2.1.3`.

[3.0.6]: https://github.com/AdguardTeam/tsurlfilter/releases/tag/tsurlfilter-v3.0.6

## [3.1.0-alpha.7] - 2024-10-16

### Fixed

- Excluding request types causes document blocking [AdguardBrowserExtension#2992].
- Not unique `eventId` on `ApplyPermissionsRule` filtering log events.

[3.1.0-alpha.7]: https://github.com/AdguardTeam/tsurlfilter/releases/tag/tsurlfilter-v3.1.0-alpha.7
[AdguardBrowserExtension#2992]: https://github.com/AdguardTeam/AdguardBrowserExtension/issues/2992

## [3.1.0-alpha.6] - 2024-10-09

### Fixed

- Content-type matching of `$permissions` and `$removeparam` rules [AdguardBrowserExtension#2954].

[3.1.0-alpha.6]: https://github.com/AdguardTeam/tsurlfilter/releases/tag/tsurlfilter-v3.1.0-alpha.6
[AdguardBrowserExtension#2954]: https://github.com/AdguardTeam/AdguardBrowserExtension/issues/2954

## [3.1.0-alpha.5] - 2024-10-02

### Changed

- Updated [@adguard/scriptlets] to `v1.12.1`.

[3.1.0-alpha.5]: https://github.com/AdguardTeam/tsurlfilter/releases/tag/tsurlfilter-v3.1.0-alpha.5

## [3.0.5] - 2024-09-26

### Fixed

- Scriptlets exclusion matching is not working properly
  for rules with arguments [AdguardBrowserExtension#2947].

[3.0.5]: https://github.com/AdguardTeam/tsurlfilter/releases/tag/tsurlfilter-v3.0.5
[AdguardBrowserExtension#2947]: https://github.com/AdguardTeam/AdguardBrowserExtension/issues/2947

## [3.1.0-alpha.4] - 2024-09-20

### Fixed

- In some cases dynamic rules can have not unique IDs [AdguardBrowserExtension#2953].

[3.1.0-alpha.4]: https://github.com/AdguardTeam/tsurlfilter/releases/tag/tsurlfilter-v3.1.0-alpha.4
[AdguardBrowserExtension#2953]: https://github.com/AdguardTeam/AdguardBrowserExtension/issues/2953

## [3.0.4] - 2024-09-19

### Changed

- Updated [@adguard/agtree] to `v2.1.2`.

[3.0.4]: https://github.com/AdguardTeam/tsurlfilter/releases/tag/tsurlfilter-v3.0.4

## [3.0.3] - 2024-09-19

### Changed

- Updated [@adguard/agtree] to `v2.1.1`.
- Updated [@adguard/css-tokenizer] to `v1.1.1`.

[3.0.3]: https://github.com/AdguardTeam/tsurlfilter/releases/tag/tsurlfilter-v3.0.3

## [3.1.0-alpha.3] - 2024-08-30

### Changed

- Updated [@adguard/scriptlets] to `v1.11.27`.

[3.1.0-alpha.3]: https://github.com/AdguardTeam/tsurlfilter/releases/tag/tsurlfilter-v3.1.0-alpha.3

## [3.0.2] - 2024-08-29

### Changed

- Updated [@adguard/scriptlets] to `v1.11.27`.

[3.0.2]: https://github.com/AdguardTeam/tsurlfilter/releases/tag/tsurlfilter-v3.0.2

## [3.0.1] - 2024-08-27

### Fixed

- Negated domains in the $to modifier are not working as expected [AdguardBrowserExtension#2910].

[3.0.1]: https://github.com/AdguardTeam/tsurlfilter/releases/tag/tsurlfilter-v3.0.1
[AdguardBrowserExtension#2910]: https://github.com/AdguardTeam/AdguardBrowserExtension/issues/2910

## [3.0.0] - 2024-08-15

### Added

- Support of pipe separator in `$permissions` modifier values [#116].
- Support for disabling specific `$stealth` options:
  `searchqueries`, `donottrack`, `referrer`, `xclientdata`, `1p-cookie` and `3p-cookie` [#100].
- Support for regexp values in `$domain` modifier of network and cosmetic rules [#41].
- New `$permissions` modifier to set Permissions-Policy response header [#66].
- New `$header` modifier to match requests by response headers [#63].
- Support conversion to DNR for `$permissions` modifier.
- Support conversion to DNR for `$cookie` modifier.
- `$url` modifier support for non-basic rules [#64].
- Ability to allowlist scriptlets by name [#377].
- New rule indexing algorithm. The storage index is now an integer representing
  the rule position in the concatenated filter list text.
  The list id is determined by the pre-stored filter list offset during the scan.
- Allowlist rule creation utilities: `createAllowlistRuleNode` and `createAllowlistRuleList`.
- `PreprocessFilterList` utility class to preprocess filter lists before scanning.
- Source map and source map utilities.
- Utility for extension resource names.

### Changed

- How rule validation on being `too wide` works. New rule is "total rule length must be 4 or more characters" [#110].
- Integrated AGTree library into the project [#85].
- `IFilter`'s content now based on `PreprocessFilterList` interface.
- Rule classes now expect AGTree AST nodes in the constructor instead of rule text.
- Reworked CSS validation. Now it's done with the [@adguard/css-tokenizer] package.
- Reworked scanning mechanism, from now on the scanner expects an AGTree byte buffer
  and reads the AGTree rule nodes from it.
- Changed `IRuleList`s `retrieveRuleText` method to `retrieveRuleNode`.
- `BufferRuleList` now expects an AGTree byte buffer in the constructor.
- `ILineReader` changed to `IReader`.
- `$header` modifier removed from supported modifiers list in the declarative converter.

### Fixed

- Shortcut extraction from regexp patterns with zero-length alternative [#69].
- Scriptlets not being logged when filtering log is open [AdguardBrowserExtension#2481].
- Filtering log clearing on `$removeparam` rule application [AdguardBrowserExtension#2442].
- Extension leaking it's instance id when redirecting requests [AdguardBrowserExtension#2278].
- Cosmetic option allowlist rules interfering with basic blocking rules [AdguardBrowserExtension#2690].

### Removed

- `BufferLineReader`, `FileLineReader`, `StringRuleList`, `RuleValidator`, `ScriptletParser`
  and `RuleConverter` classes.
- Cosmetic rule parser.

[3.0.0]: https://github.com/AdguardTeam/tsurlfilter/releases/tag/tsurlfilter-v3.0.0
[#116]: https://github.com/AdguardTeam/tsurlfilter/issues/116
[#110]: https://github.com/AdguardTeam/tsurlfilter/issues/110
[#100]: https://github.com/AdguardTeam/tsurlfilter/issues/100
[#85]: https://github.com/AdguardTeam/tsurlfilter/issues/85
[#69]: https://github.com/AdguardTeam/tsurlfilter/issues/69
[#64]: https://github.com/AdguardTeam/tsurlfilter/issues/64
[#63]: https://github.com/AdguardTeam/tsurlfilter/issues/63
[#41]: https://github.com/AdguardTeam/tsurlfilter/issues/41
[AdguardBrowserExtension#2690]: https://github.com/AdguardTeam/AdguardBrowserExtension/issues/2690
[AdguardBrowserExtension#2278]: https://github.com/AdguardTeam/AdguardBrowserExtension/issues/2278

## [2.2.23] - 2024-08-01

### Changed

- Updated [@adguard/scriptlets] to `v1.11.16`.

[2.2.23]: https://github.com/AdguardTeam/tsurlfilter/releases/tag/tsurlfilter-v2.2.23

## [2.2.22] - 2024-07-17

### Fixed

- listId -1 not found in the storage

[2.2.22]: https://github.com/AdguardTeam/tsurlfilter/releases/tag/tsurlfilter-v2.2.22

## [2.2.21] - 2024-07-12

### Changed

- Updated [@adguard/scriptlets] to `v1.11.6`.

[2.2.21]: https://github.com/AdguardTeam/tsurlfilter/releases/tag/tsurlfilter-v2.2.21

## [2.2.20] - 2024-07-01

### Added

- Ability to allowlist scriptlets by name [Scriptlets#377].
- New rule indexing algorithm. The storage index is now an integer representing
  the rule position in the concatenated filter list text.
  The list id is determined by the pre-stored filter list offset during the scan.

### Changed

- Updated [@adguard/scriptlets] to `v1.11.1`.

[2.2.20]: https://github.com/AdguardTeam/tsurlfilter/releases/tag/tsurlfilter-v2.2.20
[Scriptlets#377]: https://github.com/AdguardTeam/Scriptlets/issues/377

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

- Updated [@adguard/scriptlets] to `v1.10.25`.

[2.2.17]: https://github.com/AdguardTeam/tsurlfilter/releases/tag/tsurlfilter-v2.2.17

## [2.2.16] - 2024-03-28

### Fixed

- Correct work `$all` and `$popup` when they both selected for request
  [AdguardBrowserExtension#2620], [AdguardBrowserExtension#2728].

[2.2.16]: https://github.com/AdguardTeam/tsurlfilter/releases/tag/tsurlfilter-v2.2.16

## [2.2.15] - 2024-03-01

### Changed

- `$popup` should not disable simple blocking rule [AdguardBrowserExtension#2728].

[2.2.15]: https://github.com/AdguardTeam/tsurlfilter/releases/tag/tsurlfilter-v2.2.15
[AdguardBrowserExtension#2728]: https://github.com/AdguardTeam/AdguardBrowserExtension/issues/2728

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

- Updated [@adguard/scriptlets] to `v1.10.1`.

[2.2.13]: https://github.com/AdguardTeam/tsurlfilter/releases/tag/tsurlfilter-v2.2.13

## [2.2.12] - 2024-02-07

### Changed

- Priority calculation for `$popup` modifier [AdguardBrowserExtension#2620].

[2.2.12]: https://github.com/AdguardTeam/tsurlfilter/releases/tag/tsurlfilter-v2.2.12
[AdguardBrowserExtension#2620]: https://github.com/AdguardTeam/AdguardBrowserExtension/issues/2620

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

- Updated [@adguard/scriptlets] to `v1.9.105`.

### Fixed

- Cosmetic rules with wildcard do not work on some domains [AdguardBrowserExtension#2650].

[2.2.9]: https://github.com/AdguardTeam/tsurlfilter/releases/tag/tsurlfilter-v2.2.9
[AdguardBrowserExtension#2650]: https://github.com/AdguardTeam/AdguardBrowserExtension/issues/2650

## [2.2.8] - 2023-12-07

### Added

- Library version number to the exports [AdguardBrowserExtension#2237].

[2.2.8]: https://github.com/AdguardTeam/tsurlfilter/releases/tag/tsurlfilter-v2.2.8
[AdguardBrowserExtension#2237]: https://github.com/AdguardTeam/AdguardBrowserExtension/issues/2237

## [2.2.7] - 2023-11-30

### Changed

- Updated [@adguard/scriptlets] to `v1.9.101`.

[2.2.7]: https://github.com/AdguardTeam/tsurlfilter/releases/tag/tsurlfilter-v2.2.7

## [2.2.6] - 2023-11-15

### Changed

- Updated [@adguard/scriptlets] to `v1.9.96`.

[2.2.6]: https://github.com/AdguardTeam/tsurlfilter/releases/tag/tsurlfilter-v2.2.6

## [2.2.5] - 2023-11-13

### Changed

- Updated [@adguard/scriptlets] to `v1.9.91`.

[2.2.5]: https://github.com/AdguardTeam/tsurlfilter/releases/tag/tsurlfilter-v2.2.5

## [2.2.4] - 2023-11-08

### Added

- Support of `$permissions` modifier for compiler validation [#66].

[2.2.4]: https://github.com/AdguardTeam/tsurlfilter/releases/tag/tsurlfilter-v2.2.4
[#66]: https://github.com/AdguardTeam/tsurlfilter/issues/66

## [2.2.3] - 2023-11-03

### Added

- Support of `$referrerpolicy` modifier for compiler validation [FiltersCompiler#191].

[2.2.3]: https://github.com/AdguardTeam/tsurlfilter/releases/tag/tsurlfilter-v2.2.3
[FiltersCompiler#191]: https://github.com/AdguardTeam/FiltersCompiler/issues/191

## [2.2.2] - 2023-10-17

### Fixed

- Added all resource types for $removeparam [AdGuardMV3#49].

[2.2.2]: https://github.com/AdguardTeam/tsurlfilter/releases/tag/tsurlfilter-v2.2.2
[AdGuardMV3#49]: https://github.com/AdguardTeam/AdGuardMV3/issues/49

## [2.2.1] - 2023-10-13

### Changed

- Updated [@adguard/scriptlets] to `v1.9.83`.

[2.2.1]: https://github.com/AdguardTeam/tsurlfilter/releases/tag/tsurlfilter-v2.2.1

## [2.2.0] - 2023-10-12

### Added

- Support for $badfilter rules to Declarative Converter.

[2.2.0]: https://github.com/AdguardTeam/tsurlfilter/releases/tag/tsurlfilter-v2.2.0

## [2.1.12] - 2023-09-25

### Fixed

- Scriptlets not being logged when filtering log is open [AdguardBrowserExtension#2481].
- Filtering log clearing on `$removeparam` rule application [AdguardBrowserExtension#2442].

[2.1.12]: https://github.com/AdguardTeam/tsurlfilter/releases/tag/tsurlfilter-v2.1.12
[AdguardBrowserExtension#2481]: https://github.com/AdguardTeam/AdguardBrowserExtension/issues/2481
[AdguardBrowserExtension#2442]: https://github.com/AdguardTeam/AdguardBrowserExtension/issues/2442

## [2.1.11] - 2023-08-25

### Changed

- Updated [@adguard/scriptlets] to `v1.9.72`.

[2.1.11]: https://github.com/AdguardTeam/tsurlfilter/releases/tag/tsurlfilter-v2.1.11

## [2.1.10] - 2023-08-21

### Changed

- Updated [@adguard/scriptlets] to `v1.9.70`.

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

- Updated [@adguard/scriptlets] to `v1.9.62`.
- Esm module now imports external dependencies instead of bundling.

[2.1.6]: https://github.com/AdguardTeam/tsurlfilter/releases/tag/tsurlfilter-v2.1.6

## [2.1.5] - 2023-07-21

### Changed

- Updated [@adguard/scriptlets] to `v1.9.57`.

[2.1.5]: https://github.com/AdguardTeam/tsurlfilter/releases/tag/tsurlfilter-v2.1.5

## [2.1.4] - 2023-07-13

### Added

- Support for `$csp` modifier in the MV3 converter.
- Scheme for converting network rules into declarative rules.

### Changed

- Converting rules in MV3 with these modifiers `$elemhide`, `$specifichide`
  and `$generichide` now does not cause any errors and is simply skipped.

### Fixed

- Matching result caching for rules with `$method` modifier.

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
  of weights for each rule type - more details in [KnowledgeBase#196].
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

[2.1.0]: https://github.com/AdguardTeam/tsurlfilter/releases/tag/tsurlfilter-v2.1.0
[KnowledgeBase#196]: https://github.com/AdguardTeam/KnowledgeBase/pull/196

## [2.0.7] - 2023-06-14

### Fixed

- Do not remove escape characters from regexp modifiers values during
  `RuleConverter.convertRule()`.

[2.0.7]: https://github.com/AdguardTeam/tsurlfilter/releases/tag/tsurlfilter-v2.0.7

## [2.0.6] - 2023-06-06

### Changed

- Updated [@adguard/scriptlets] to `v1.9.37`.

### Fixed

- Domain matching for wildcard tld in rules.

[2.0.6]: https://github.com/AdguardTeam/tsurlfilter/releases/tag/tsurlfilter-v2.0.6

## [2.0.5] - 2023-04-24

### Changed

- RuleConverter speed has been improved by 2x [#83].
- Declarative converter build has been separated from the main package.

[2.0.5]: https://github.com/AdguardTeam/tsurlfilter/releases/tag/tsurlfilter-v2.0.5
[#83]: https://github.com/AdguardTeam/tsurlfilter/issues/83

<!-- 2.0.4 is the same as 2.0.3, no difference -->

## [2.0.3] - 2023-04-17

### Fixed

- `require` export of `umd`.

[2.0.3]: https://github.com/AdguardTeam/tsurlfilter/releases/tag/tsurlfilter-v2.0.3

## [2.0.2] - 2023-04-17

### Changed

- Updated [@adguard/scriptlets] to `v1.9.7`.

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

- Updated [@adguard/scriptlets] to `v1.9.1`.

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

- Updated [@adguard/scriptlets] to `v1.9.1`.

[1.0.77]: https://github.com/AdguardTeam/tsurlfilter/releases/tag/tsurlfilter-v1.0.77

## [1.0.76] - 2023-03-01

### Fixed

- Avoid cases where two `CssHitsCounter`s try to append and remove the same
  elements one after another.

[1.0.76]: https://github.com/AdguardTeam/tsurlfilter/releases/tag/tsurlfilter-v1.0.76

## [1.0.75] - 2023-02-17

### Changed

- Updated [@adguard/extended-css] to `v2.0.51`.

[1.0.75]: https://github.com/AdguardTeam/tsurlfilter/releases/tag/tsurlfilter-v1.0.75

## [1.0.74] - 2023-02-07

### Changed

- Updated [@adguard/extended-css] to `v2.0.49`.

[1.0.74]: https://github.com/AdguardTeam/tsurlfilter/releases/tag/tsurlfilter-v1.0.74

## [1.0.73] - 2023-02-01

### Changed

- Updated [@adguard/extended-css] to `v2.0.45`.

[1.0.73]: https://github.com/AdguardTeam/tsurlfilter/releases/tag/tsurlfilter-v1.0.73

## [1.0.70] - 2023-01-19

### Changed

- Updated [@adguard/scriptlets] to `v1.8.2`.

[1.0.70]: https://github.com/AdguardTeam/tsurlfilter/releases/tag/tsurlfilter-v1.0.70

## [1.0.68] - 2022-12-28

### Added

- Simple support of `$hls` modifier — just for compiler validation.

### Changed

- Removed unnecessary brackets for unknown pseudo-class validation error.

[1.0.68]: https://github.com/AdguardTeam/tsurlfilter/releases/tag/tsurlfilter-v1.0.68

## [1.0.67] - 2022-12-27

### Added

- Simple support of `$jsonprune` modifier — just for compiler validation.

### Changed

- Improved selector validation unknown pseudo-class error.

[1.0.67]: https://github.com/AdguardTeam/tsurlfilter/releases/tag/tsurlfilter-v1.0.67

## [1.0.66] - 2022-12-23

### Removed

- Support of `$webrtc` modifier.

[1.0.66]: https://github.com/AdguardTeam/tsurlfilter/releases/tag/tsurlfilter-v1.0.66

## [1.0.65] - 2022-12-22

### Changed

- Updated [@adguard/extended-css] to `v2.0.33`.
- Updated [@adguard/scriptlets] to `v1.7.19`.

[1.0.65]: https://github.com/AdguardTeam/tsurlfilter/releases/tag/tsurlfilter-v1.0.65

## [1.0.64] - 2022-12-16

### Changed

- Updated [@adguard/scriptlets] to `v1.7.14`.

[1.0.64]: https://github.com/AdguardTeam/tsurlfilter/releases/tag/tsurlfilter-v1.0.64

## [1.0.63] - 2022-12-13

### Changed

- Updated [@adguard/scriptlets] to `v1.7.13`.

[1.0.63]: https://github.com/AdguardTeam/tsurlfilter/releases/tag/tsurlfilter-v1.0.63

## [1.0.62] -  2022-12-12

### Changed

- Always consider `:has()` pseudo-class as extended.

[1.0.62]: https://github.com/AdguardTeam/tsurlfilter/releases/tag/tsurlfilter-v1.0.62

## [1.0.59] - 2022-12-08

### Changed

- Updated [@adguard/extended-css] to `v2.0.26`.

[1.0.59]: https://github.com/AdguardTeam/tsurlfilter/releases/tag/tsurlfilter-v1.0.59

## [1.0.57] - 2022-12-06

### Changed

- Updated [@adguard/extended-css] to `v2.0.24`.
- Updated [@adguard/scriptlets] to `v1.7.10`.

### Removed

- `:if()` and `:if-not()` pseudo-classes

[1.0.57]: https://github.com/AdguardTeam/tsurlfilter/releases/tag/tsurlfilter-v1.0.57

[@adguard/agtree]: ../agtree/CHANGELOG.md
[@adguard/css-tokenizer]: ../css-tokenizer/CHANGELOG.md

[@adguard/extended-css]: https://github.com/AdguardTeam/ExtendedCss/blob/master/CHANGELOG.md
[@adguard/scriptlets]: https://github.com/AdguardTeam/Scriptlets/blob/master/CHANGELOG.md
