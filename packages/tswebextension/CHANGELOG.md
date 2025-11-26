# TSWebExtension Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [3.2.16] - 2025-11-26

### Changed

- Updated [@adguard/assistant] to `v4.3.77`.
- Updated [@adguard/agtree] to `v3.3.1`.
- Updated [@adguard/scriptlets] to `v2.2.13`.
- Updated [@adguard/tsurlfilter] to `v3.5.1`.

## [3.2.15] - 2025-11-12

### Changed

- Updated [@adguard/agtree] to `v3.2.5`.
- Updated [@adguard/scriptlets] to `v2.2.12`.
- Updated [@adguard/tsurlfilter] to `v3.4.8`.

[3.2.15]: https://github.com/AdguardTeam/tsurlfilter/releases/tag/tswebextension-v3.2.15

## [3.2.14] - 2025-10-17

### Changed

- Updated [@adguard/agtree] to `v3.2.4`.
- Updated [@adguard/scriptlets] to `v2.2.11`.
- Updated [@adguard/tsurlfilter] to `v3.4.7`.

[3.2.14]: https://github.com/AdguardTeam/tsurlfilter/releases/tag/tswebextension-v3.2.14

## [3.2.13] - 2025-10-15

### Fixed

- Original DNR rules for unsafe rules aren’t being logged in the Filtering Log [AdguardBrowserExtension#3327].

[3.2.13]: https://github.com/AdguardTeam/tsurlfilter/releases/tag/tswebextension-v3.2.13
[AdguardBrowserExtension#3327]: https://github.com/AdguardTeam/AdguardBrowserExtension/issues/3327

## [3.2.12] - 2025-10-14

### Fixed

- Unsafe rules were not removed on disabling filtering in MV3.

[3.2.12]: https://github.com/AdguardTeam/tsurlfilter/releases/tag/tswebextension-v3.2.12

## [3.2.11] - 2025-09-11

### Changed

- Updated [@adguard/agtree] to `v3.2.3`.
- Updated [@adguard/scriptlets] to `v2.2.10`.
- Updated [@adguard/tsurlfilter] to `v3.4.6`.

[3.2.11]: https://github.com/AdguardTeam/tsurlfilter/releases/tag/tswebextension-v3.2.11

## [3.2.10] - 2025-09-09

### Fixed

- Mismatches in caching strategy for rulesets in MV3.

[3.2.10]: https://github.com/AdguardTeam/tsurlfilter/releases/tag/tswebextension-v3.2.10

## [3.2.9] - 2025-09-02

### Fixed

- Incorrect handling internal error message when passed empty array of user rules.

[3.2.9]: https://github.com/AdguardTeam/tsurlfilter/releases/tag/tswebextension-v3.2.9

## [3.2.8] - 2025-09-02

### Removed

- Static getter `isUserScriptsApiSupported`.

### Added

- Separate export `isUserScriptsApiEnabled` function from
  `@adguard/tswebextension/mv3/utils` to check if the current browser supports
  User Scripts API.

[3.2.8]: https://github.com/AdguardTeam/tsurlfilter/releases/tag/tswebextension-v3.2.8

## [3.2.7] - 2025-07-30

### Changed

- Updated [@adguard/assistant] to `v4.3.75`.

[3.2.7]: https://github.com/AdguardTeam/tsurlfilter/releases/tag/tswebextension-v3.2.7

## [3.2.6] - 2025-07-25

### Fixed

- Declarative filtering log errors while new configuration applying in MV3.

[3.2.6]: https://github.com/AdguardTeam/tsurlfilter/releases/tag/tswebextension-v3.2.6

## [3.2.5] - 2025-07-10

### Changed

- Updated [@adguard/tsurlfilter] to `v3.4.5`.

### Fixed

- Wrong rule is displayed for page blocked by `$document` rule in MV3 [AdguardBrowserExtension#3260].

[3.2.5]: https://github.com/AdguardTeam/tsurlfilter/releases/tag/tswebextension-v3.2.5
[AdguardBrowserExtension#3260]: https://github.com/AdguardTeam/AdguardBrowserExtension/issues/3260

## [3.2.4] - 2025-07-03

### Changed

- Updated [@adguard/tsurlfilter] to `v3.4.2`.

[3.2.4]: https://github.com/AdguardTeam/tsurlfilter/releases/tag/tswebextension-v3.2.4

## [3.2.3] - 2025-07-02

### Added

- Using unsafe rules from rulesets metadata in MV3 to allow "skip review"
  feature in CWS.

### Changed

- Updated [@adguard/tsurlfilter] to `v3.4.1`.

### Fixed

- CLI was not worked since switch to ESM builds.

[3.2.3]: https://github.com/AdguardTeam/tsurlfilter/releases/tag/tswebextension-v3.2.3

## [3.2.2] - 2025-06-30

### Changed

- Updated [@adguard/assistant] to `v4.3.74`.

[3.2.2]: https://github.com/AdguardTeam/tsurlfilter/releases/tag/tswebextension-v3.2.2

## [3.2.1] - 2025-06-11

### Fixed

- Error logging during user script execution via `chrome.userScripts` API.
- Session rules logging which are used for Tracking protection.

[3.2.1]: https://github.com/AdguardTeam/tsurlfilter/releases/tag/tswebextension-v3.2.1

## [3.2.0] - 2025-06-06

### Added

- Extension blocking page support for requests blocked by `$document` rules in MV3.
- `filterId` query param to `documentBlockingPageUrl` for both MV2 and MV3 [#35].
- Support for Chrome's User Scripts API that allows more reliable script
  injection in MV3 if developer mode is enabled.
- Static getter `isUserScriptsApiSupported` to check if the current browser
  supports User Scripts API.

### Changed

- Updated [@adguard/logger] to `v2.0.0`.
- Updated [@adguard/scriptlets] to `v2.2.7`.
- Updated [@adguard/tsurlfilter] to `v3.4.0`.

### Fixed

- Invalid HTML filtering rule selectors are breaking site loading
  [AdguardBrowserExtension#2646], [AdguardBrowserExtension#2826].
- Scriptlet rules are not displayed in the filtering log [AdguardBrowserExtension#3164].
- Stealth mode's `Hide Referer from third parties` option may break some websites [AdguardBrowserExtension#2839].
- Filtering doesn't work in Edge's split screen [AdguardBrowserExtension#2832].
- `$replace` rules may break some websites [AdguardBrowserExtension#3122].
- Increase file size limit to 10MB for `$replace` rules in Firefox [AdguardBrowserExtension#3192].
- Allow to specify attributes without value in selector for HTML filtering rules [#147].

[3.2.0]: https://github.com/AdguardTeam/tsurlfilter/releases/tag/tswebextension-v3.2.0
[#35]: https://github.com/AdguardTeam/tsurlfilter/issues/35
[#147]: https://github.com/AdguardTeam/tsurlfilter/issues/147
[AdguardBrowserExtension#2646]: https://github.com/AdguardTeam/AdguardBrowserExtension/issues/2646
[AdguardBrowserExtension#2826]: https://github.com/AdguardTeam/AdguardBrowserExtension/issues/2826
[AdguardBrowserExtension#2832]: https://github.com/AdguardTeam/AdguardBrowserExtension/issues/2832
[AdguardBrowserExtension#2839]: https://github.com/AdguardTeam/AdguardBrowserExtension/issues/2839
[AdguardBrowserExtension#3122]: https://github.com/AdguardTeam/AdguardBrowserExtension/issues/3122
[AdguardBrowserExtension#3164]: https://github.com/AdguardTeam/AdguardBrowserExtension/issues/3164
[AdguardBrowserExtension#3192]: https://github.com/AdguardTeam/AdguardBrowserExtension/issues/3192

## [3.1.0] - 2025-05-28

### Changed

- Updated [@adguard/agtree] to `v3.2.1`.
- Updated [@adguard/tsurlfilter] to `v3.3.4`.

### Fixed

- Types for `NodeNext` module resolution.

[3.1.0]: https://github.com/AdguardTeam/tsurlfilter/releases/tag/tswebextension-v3.1.0

## [3.1.0-alpha.3] - 2025-05-22

### Changed

- Updated [@adguard/agtree] to `v3.2.0`.
- Updated [@adguard/tsurlfilter] to `v3.3.3`.

### Fixed

- Improved rule set caching to avoid inconsistent behaviors.
- Improved rule set update in declarative filtering log to avoid unexpected behaviors during configuration changes.

[3.1.0-alpha.3]: https://github.com/AdguardTeam/tsurlfilter/releases/tag/tswebextension-v3.1.0-alpha.3

## [3.1.0-alpha.2] - 2025-05-19

### Changed

- Updated [@adguard/agtree] to `v3.1.4`.
- Updated [@adguard/tsurlfilter] to `v3.3.2`.

### Fixed

- Updated `zod` dependency to version `3.24.4` to resolve vulnerability warnings.

[3.1.0-alpha.2]: https://github.com/AdguardTeam/tsurlfilter/releases/tag/tswebextension-v3.1.0-alpha.2

## [3.1.0-alpha.1] - 2025-05-15

### Changed

- Updated [@adguard/tsurlfilter] to `v3.3.1`.

[3.1.0-alpha.1]: https://github.com/AdguardTeam/tsurlfilter/releases/tag/tswebextension-v3.1.0-alpha.1

## [3.1.0-alpha.0] - 2025-04-30

### Changed

- Updated [@adguard/agtree] to `v3.1.3`.
- Updated [@adguard/tsurlfilter] to `v3.3.0-alpha.0`.
- Instead of byte ranges, rulesets will be synchronized to IndexedDB internally.

### Removed

- `FiltersApi` export.

[3.1.0-alpha.0]: https://github.com/AdguardTeam/tsurlfilter/releases/tag/tswebextension-v3.1.0-alpha.0

## [3.0.2] - 2025-04-15

### Changed

- Updated [@adguard/tsurlfilter] to `v3.2.3`.

## [3.0.1] - 2025-03-06

### Changed

- Updated [@adguard/scriptlets] to `v2.1.6`.

[3.0.1]: https://github.com/AdguardTeam/tsurlfilter/releases/tag/tswebextension-v3.0.1

## [3.0.0] - 2025-02-28

### Added

- Possibility to get filter data from "sync storage" in MV3.

### Changed

- Updated [@adguard/tsurlfilter] to `v3.2.0`.
- Updated [@adguard/scriptlets] to `v2.1.5`.
- Updated [@adguard/agtree] to `v3.0.1`.
- Renamed the export `RULE_SET_NAME_PREFIX` to `RULESET_NAME_PREFIX`.
- `retrieveDynamicRuleNode` function was renamed to `retrieveRuleNode`
  and can now retrieve any rule node from the engine.
- Minimum supported Chromium-based MV2 browsers version now 106+ for support
  prerender requests.

### Fixed

- Cosmetic rules injecting into `about:blank` iframes in MV2.
- Scriptlets and scripts are executed too late on website reload
  or navigation in MV2 [AdguardBrowserExtension#2855].
- Do not inject cosmetic rules into the Assistant frame in MV3.

[3.0.0]: https://github.com/AdguardTeam/tsurlfilter/releases/tag/tswebextension-v3.0.0
[AdguardBrowserExtension#2855]: https://github.com/AdguardTeam/AdguardBrowserExtension/issues/2855

## [3.0.0-alpha.1] - 2025-01-30

### Added

- `StealthActions` event to filtering log for MV3.
- Implemented `StealthAllowlistAction` event to filtering log.
- Graceful handling errors about enabling/disabling stealth rules.
- Support for separating rules into safe and unsafe in declarative converter.

### Changed

- Drop UMD support, now only ESM builds.
- Updated [@adguard/agtree] to `v3.0.0-alpha.3`.
- Updated [@adguard/scriptlets] to `v2.1.4`.
- Updated [@adguard/tsurlfilter] to `v3.1.0-alpha.8`.
- Updated [@adguard/extended-css] to `v2.1.1`.

### Fixed

- Once allowlisted tab considers all following websites in the tab as allowlisted [AdguardBrowserExtension#3020].
- A rule from a disabled filter list disables another rule [AdguardBrowserExtension#3002].
- Matching of `companyCategoryName` for subdomains.

[3.0.0-alpha.1]: https://github.com/AdguardTeam/tsurlfilter/releases/tag/tswebextension-v3.0.0-alpha.1
[AdguardBrowserExtension#3020]: https://github.com/AdguardTeam/AdguardBrowserExtension/issues/3020
[AdguardBrowserExtension#3002]: https://github.com/AdguardTeam/AdguardBrowserExtension/issues/3002

## [2.4.0-alpha.11] - 2025-01-29

### Removed

- Local Scriptlet rules allowing. This is a reversion of `2.4.0-alpha.10` changes
  so there is no more limitation on Scriptlet rules execution.

[2.4.0-alpha.11]: https://github.com/AdguardTeam/tsurlfilter/releases/tag/tswebextension-v2.4.0-alpha.11

## [2.4.0-alpha.10] - 2025-01-17

### Changed

- Remade Scriptlet rules execution in MV3 — only rules from the pre-built filters are allowed now.

[2.4.0-alpha.10]: https://github.com/AdguardTeam/tsurlfilter/releases/tag/tswebextension-v2.4.0-alpha.10

## [2.4.0-alpha.9] - 2025-01-13

### Removed

- Injection of remotely hosted script rules.

[2.4.0-alpha.9]: https://github.com/AdguardTeam/tsurlfilter/releases/tag/tswebextension-v2.4.0-alpha.9

## [2.4.0-alpha.8] - 2024-12-23

### Changed

- Remade JS rules injections in MV3:
    - use `chrome.scripting` API for injecting functions for script rules from the pre-built filters,
    - use script tag injection only for script rules manually added by users —
      rules from *User rules* and *Custom filters*.

[2.4.0-alpha.8]: https://github.com/AdguardTeam/tsurlfilter/releases/tag/tswebextension-v2.4.0-alpha.8

## [2.0.7] - 2024-11-20

### Fixed

- Memory leak caused by multiple script injections on the same pages
  after an event page in Firefox restarts in MV2 [AdguardBrowserExtension#2594].

[2.0.7]: https://github.com/AdguardTeam/tsurlfilter/releases/tag/tswebextension-v2.0.7

## [2.4.0-alpha.7] - 2024-11-20

### Fixed

- Memory leak caused by multiple script injections on the same pages
  after a service worker or event page restart [AdguardBrowserExtension#2594].

[2.4.0-alpha.7]: https://github.com/AdguardTeam/tsurlfilter/releases/tag/tswebextension-v2.4.0-alpha.6
[AdguardBrowserExtension#2594]: https://github.com/AdguardTeam/AdguardBrowserExtension/issues/2594

## [2.0.6] - 2024-11-19

### Changed

- Updated [@adguard/tsurlfilter] to `v3.0.7`.

[2.0.6]: https://github.com/AdguardTeam/tsurlfilter/releases/tag/tswebextension-v2.0.6

## [2.0.5] - 2024-11-02

### Changed

- Updated [@adguard/agtree] to `v2.1.3`.
- Updated [@adguard/tsurlfilter] to `v3.0.6`.

[2.0.5]: https://github.com/AdguardTeam/tsurlfilter/releases/tag/tswebextension-v2.0.5

## [2.4.0-alpha.6] - 2024-10-18

### Fixed

- Incorrect caching strategy for filters and rulesets.

[2.4.0-alpha.6]: https://github.com/AdguardTeam/tsurlfilter/releases/tag/tswebextension-v2.4.0-alpha.6

## [2.4.0-alpha.5] - 2024-10-17

### Fixed

- Allowlist determination for a new tab.

[2.4.0-alpha.5]: https://github.com/AdguardTeam/tsurlfilter/releases/tag/tswebextension-v2.4.0-alpha.5

## [2.4.0-alpha.4] - 2024-10-16

### Changed

- Updated [@adguard/tsurlfilter] to `v3.1.0-alpha.7`.

### Fixed

- Correct export of `EXTENDED_CSS_VERSION` for MV3 version.

[2.4.0-alpha.4]: https://github.com/AdguardTeam/tsurlfilter/releases/tag/tswebextension-v2.4.0-alpha.4

## [2.0.4] - 2024-10-16

### Fixed

- Not unique `eventId` on `ApplyPermissionsRule` filtering log events.

[2.0.4]: https://github.com/AdguardTeam/tsurlfilter/releases/tag/tswebextension-v2.0.4

## [2.4.0-alpha.3] - 2024-10-09

### Changed

- Updated [@adguard/logger] to `v1.1.0`.

### Fixed

- MV3 extension cannot apply rules to `about:blank` iframes [AdguardBrowserExtension#2975].
- JS rules are blocked by Trusted Types on some websites [AdguardBrowserExtension#2980].
- Scriptlets logging does not work [AdguardBrowserExtension#2977].

[2.4.0-alpha.3]: https://github.com/AdguardTeam/tsurlfilter/releases/tag/tswebextension-v2.4.0-alpha.3
[AdguardBrowserExtension#2975]: https://github.com/AdguardTeam/AdguardBrowserExtension/issues/2975
[AdguardBrowserExtension#2977]: https://github.com/AdguardTeam/AdguardBrowserExtension/issues/2977
[AdguardBrowserExtension#2980]: https://github.com/AdguardTeam/AdguardBrowserExtension/issues/2980

## [2.3.0-alpha.1] - 2024-10-02

### Changed

- Added new field to MV3 config: `quickFixesRules` which will be applied to
  the dynamic rules.
- Updated [@adguard/tsurlfilter] to `v3.1.0-alpha.5`.
- Updated [@adguard/scriptlets] to `v1.12.1`.

### Added

- `companyCategoryName` property in filtering log `ApplyBasicRuleEvent` for `$redirect` rules [#137].
- `isAssuredlyBlocked` property in filtering log `ApplyBasicRuleEvent` for definitely blocked requests im MV3.

[2.3.0-alpha.1]: https://github.com/AdguardTeam/tsurlfilter/releases/tag/tswebextension-v2.3.0-alpha.1
[#137]: https://github.com/AdguardTeam/tsurlfilter/issues/137

## [2.0.3] - 2024-09-26

### Changed

- Updated [@adguard/agtree] to `v2.1.2`.
- Updated [@adguard/tsurlfilter] to `v3.0.5`.
- Updated [@adguard/scriptlets] to `v1.12.1`.

[2.0.3]: https://github.com/AdguardTeam/tsurlfilter/releases/tag/tswebextension-v2.0.3

## [2.2.0-alpha.1] - 2024-08-30

### Changed

- Filtering log `ApplyBasicRuleEvent` now contains `companyCategoryName` property
  which represents a matched company from `AdguardTeam/companiesdb`'s `trackers.json` database in MV3.
  It allows to determinate the tracker category for the blocked request.
- Inject scriptlets separately to avoid CSP issues in MV3.
- Updated [@adguard/scriptlets] to `v1.11.27`.

### Fixed

- Incorrect applying allowlist [#139].

[2.2.0-alpha.1]: https://github.com/AdguardTeam/tsurlfilter/releases/tag/tswebextension-v2.2.0-alpha.1
[#139]: https://github.com/AdguardTeam/tsurlfilter/issues/139

## [2.0.2] - 2024-08-29

### Changed

- Updated [@adguard/tsurlfilter] to `v3.0.2`.
- Updated [@adguard/scriptlets] to `v1.11.27`.

[2.0.2]: https://github.com/AdguardTeam/tsurlfilter/releases/tag/tswebextension-v2.0.2

## [2.0.1] - 2024-08-27

### Fixed

- Redirect rule causes a CSP error instead of redirecting [AdguardBrowserExtension#2913].

[2.0.1]: https://github.com/AdguardTeam/tsurlfilter/releases/tag/tswebextension-v2.0.1
[AdguardBrowserExtension#2913]: https://github.com/AdguardTeam/AdguardBrowserExtension/issues/2913

## [2.0.0] - 2024-08-15

### Added

- Stealth Mode support for MV3. New required `gpcScriptUrl` and `hideDocumentReferrerScriptUrl` configuration
  properties are provided to specify the path to stealth content scripts.
- Content Script for setting GPC signal bundled to separate module `@adguard/tswebextension/mv3/gpc`.
- Content Script for hiding Document Referrer bundled
  to separate module `@adguard/tswebextension/mv3/hideDocumentReferrer`.
- Possibility to retrieve AST for dynamically generated rules via the `retrieveDynamicRuleNode` method.
- Support for `$cookie` modifier in MV3 via `browser.cookies` API and content-script.
- Support for disabling specific `$stealth` options: `searchqueries`, `donottrack`, `referrer`, `xclientdata`,
  `1p-cookie` and `3p-cookie` [#100].
- Export `EventChannel` utility class in MV3 build.

### Changed

- Filtering log to not reload on History API navigation [AdguardBrowserExtension#2598].
- Extension to stop injecting content-script into xml documents
  to prevent pretty printer breakage in Firefox [AdguardBrowserExtension#2194].
- Configuration interface now expects an AGTree byte buffer instead of a raw filter list.
- CSS hits counter uses rule index instead of rule text.
- Filtering log events are simplified and now contain only the necessary information, not the entire rule.
- Allowlist rule generation logic is moved to [@adguard/tsurlfilter] package.
- Updated [@adguard/tsurlfilter] to `v3.0.0`.
- Updated [@adguard/scriptlets] to `v1.11.6`.

### Fixed

- Handling of internal urls (e.g `view-source:...`) [AdguardBrowserExtension#2549].
- Blocked ads count leaking between websites [AdguardBrowserExtension#2080].
- Breakage of cookie string in Firefox and unnecessary cookie serialization [AdguardBrowserExtension#2552].
- Use data URL-based redirect resources where possible [AdguardBrowserExtension#2278].
- `$permissions` modifier service now correctly handles subdocuments and exceptions.
- Applying `$cookie` rules on the content-script side.
- `$csp`, `$removeparam` and `$removeheader` allowlist rules not being published as filtering log events.
- Detection of popup tabs [AdguardBrowserExtension#2890].

[2.0.0]: https://github.com/AdguardTeam/tsurlfilter/releases/tag/tswebextension-v2.0.0
[#100]: https://github.com/AdguardTeam/tsurlfilter/issues/100
[AdguardBrowserExtension#2890]: https://github.com/AdguardTeam/AdguardBrowserExtension/issues/2890
[AdguardBrowserExtension#2080]: https://github.com/AdguardTeam/AdguardBrowserExtension/issues/2080
[AdguardBrowserExtension#2194]: https://github.com/AdguardTeam/AdguardBrowserExtension/issues/2194
[AdguardBrowserExtension#2278]: https://github.com/AdguardTeam/AdguardBrowserExtension/issues/2278
[AdguardBrowserExtension#2549]: https://github.com/AdguardTeam/AdguardBrowserExtension/issues/2549
[AdguardBrowserExtension#2552]: https://github.com/AdguardTeam/AdguardBrowserExtension/issues/2552
[AdguardBrowserExtension#2598]: https://github.com/AdguardTeam/AdguardBrowserExtension/issues/2598

## [1.0.32] - 2024-08-01

### Changed

- Updated [@adguard/tsurlfilter] to `v2.2.23`.
- Updated [@adguard/scriptlets] to `v1.11.16`.

[1.0.32]: https://github.com/AdguardTeam/tsurlfilter/releases/tag/tswebextension-v1.0.32

## [2.1.0-alpha.3] - 2024-08-01

### Added

- Applied cosmetic rules now logging in the `mv3` build.

[2.1.0-alpha.3]: https://github.com/AdguardTeam/tsurlfilter/releases/tag/tswebextension-v2.1.0-alpha.3

## [2.0.0-beta.0] - 2024-07-30

### Fixed

- [@adguard/agtree] dependency now used consistently in the project.

[2.0.0-beta.0]: https://github.com/AdguardTeam/tsurlfilter/releases/tag/tswebextension-v2.0.0-beta.0

## [2.0.0-alpha.2] - 2024-07-17

### Changed

- Updated [@adguard/tsurlfilter] to `v3.0.0-alpha.1`.
- Updated [@adguard/scriptlets] to `v1.11.6`.

[2.0.0-alpha.2]: https://github.com/AdguardTeam/tsurlfilter/releases/tag/tswebextension-v2.0.0-alpha.2

## [2.0.0-alpha.1] - 2024-07-08

### Added

- Export `EventChannel` utility class in MV3 build.

[2.0.0-alpha.1]: https://github.com/AdguardTeam/tsurlfilter/releases/tag/tswebextension-v2.0.0-alpha.1

## [1.0.30] - 2024-07-17

### Changed

- Updated [@adguard/tsurlfilter] to `v2.2.22`.

[1.0.30]: https://github.com/AdguardTeam/tsurlfilter/releases/tag/tswebextension-v1.0.30

## [1.0.29] - 2024-07-12

### Changed

- Updated [@adguard/tsurlfilter] to `v2.2.21`.
- Updated [@adguard/scriptlets] to `v1.11.6`.

[1.0.29]: https://github.com/AdguardTeam/tsurlfilter/releases/tag/tswebextension-v1.0.29

## [1.0.28] - 2024-07-08

### Fixed

- CssHitsCounter logs elements blocked by elemhide rules.

[1.0.28]: https://github.com/AdguardTeam/tsurlfilter/releases/tag/tswebextension-v1.0.28

## [1.0.27] - 2024-07-08

### Changed

- CssHitsCounter can log elements without converting to string [CoreLibs#180].

[1.0.27]: https://github.com/AdguardTeam/tsurlfilter/releases/tag/tswebextension-v1.0.27
[CoreLibs#180]: https://github.com/AdguardTeam/CoreLibs/issues/180

## [1.0.26] - 2024-07-01

### Changed

- Updated [@adguard/tsurlfilter] to `v2.2.20`.
- Updated [@adguard/scriptlets] to `v1.11.1`.

[1.0.26]: https://github.com/AdguardTeam/tsurlfilter/releases/tag/tswebextension-v1.0.26

## [1.0.25] - 2024-05-23

## Fixed

- Extension injects scripts every time the extension's background event page wakes up [AdguardBrowserExtension#2792].

[1.0.25]: https://github.com/AdguardTeam/tsurlfilter/releases/tag/tswebextension-v1.0.25
[AdguardBrowserExtension#2792]: https://github.com/AdguardTeam/AdguardBrowserExtension/issues/2792

## [1.0.24] - 2024-04-15

### Fixed

- Script rules are not applied in Firefox due to CSP [AdguardBrowserExtension#1733].

[1.0.24]: https://github.com/AdguardTeam/tsurlfilter/releases/tag/tswebextension-v1.0.24
[AdguardBrowserExtension#1733]: https://github.com/AdguardTeam/AdguardBrowserExtension/issues/1733

## [1.0.23] - 2024-04-15

### Changed

- Error logging level on setting cookie with mismatched domain and request URL [AdguardBrowserExtension#2683].

[1.0.23]: https://github.com/AdguardTeam/tsurlfilter/releases/tag/tswebextension-v1.0.23
[AdguardBrowserExtension#2683]: https://github.com/AdguardTeam/AdguardBrowserExtension/issues/2683

## [1.0.21] - 2024-03-29

### Fixed

- Do not block "Should collapse" mechanism with `$popup` rules.

[1.0.21]: https://github.com/AdguardTeam/tsurlfilter/releases/tag/tswebextension-v1.0.21

## [1.0.20] - 2024-03-28

### Changed

- Analysis of `$popup` rules (in addition to the basic one) to determine
  the result of blocking a request [AdguardBrowserExtension#2620], [AdguardBrowserExtension#2728].
- Updated [@adguard/tsurlfilter] to `v2.2.17`.
- Updated [@adguard/scriptlets] to `v1.10.25`.

[1.0.20]: https://github.com/AdguardTeam/tsurlfilter/releases/tag/tswebextension-v1.0.20

## [1.0.18] - 2024-03-25

### Fixed

- Improved assistant iframe checking for cosmetic rules injection [AdguardBrowserExtension#1848].

[1.0.18]: https://github.com/AdguardTeam/tsurlfilter/releases/tag/tswebextension-v1.0.18

## [1.0.17] - 2024-03-25

### Fixed

- Assistant iframe styles are affected by cosmetic rules specific for websites [AdguardBrowserExtension#1848].

[1.0.17]: https://github.com/AdguardTeam/tsurlfilter/releases/tag/tswebextension-v1.0.17
[AdguardBrowserExtension#1848]: https://github.com/AdguardTeam/AdguardBrowserExtension/issues/1848

## [1.0.16] - 2024-03-01

### Changed

- `$popup` should not disable simple blocking rule [AdguardBrowserExtension#2728].

[1.0.16]: https://github.com/AdguardTeam/tsurlfilter/releases/tag/tswebextension-v1.0.16
[AdguardBrowserExtension#2728]: https://github.com/AdguardTeam/AdguardBrowserExtension/issues/2728

## [1.0.15] - 2024-02-22

### Fixed

- `$popup` modifier block other types of resources [AdguardBrowserExtension#2723].

[1.0.15]: https://github.com/AdguardTeam/tsurlfilter/releases/tag/tswebextension-v1.0.15
[AdguardBrowserExtension#2723]: https://github.com/AdguardTeam/AdguardBrowserExtension/issues/2723

## [1.0.14] - 2024-02-13

### Changed

- Filtering engine now uses the new `BufferRuleList` provided by [@adguard/tsurlfilter]
  to improve performance and memory usage.

[1.0.14]: https://github.com/AdguardTeam/tsurlfilter/releases/tag/tswebextension-v1.0.14

## [1.0.13] - 2024-02-13

### Added

- New cleanup mechanism for `RequestContextStorage` to prevent memory leaks
  during internal redirects.

### Changed

- Updated [@adguard/tsurlfilter] to `v2.2.13`.
- Updated [@adguard/scriptlets] to `v1.10.1`.

### Fixed

- Prevent memory leaks due to V8 optimizations of substring operations.

[1.0.13]: https://github.com/AdguardTeam/tsurlfilter/releases/tag/tswebextension-v1.0.13

## [1.0.12] - 2024-02-07

### Fixed

- Applying of `$all` modifier rules [AdguardBrowserExtension#2620].

[1.0.12]: https://github.com/AdguardTeam/tsurlfilter/releases/tag/tswebextension-v1.0.12
[AdguardBrowserExtension#2620]: https://github.com/AdguardTeam/AdguardBrowserExtension/issues/2620

## [1.0.11] - 2024-02-06

### Fixed

- Incorrect handling hook `webNavigation.onCommitted` for Opera with force
  recalculating matching result.
- Correct export of `EXTENDED_CSS_VERSION` for mv2 version.

[1.0.11]: https://github.com/AdguardTeam/tsurlfilter/releases/tag/tswebextension-v1.0.11

## [1.0.10] - 2024-01-27

### Fixed

- Export correct types for TS.
- Exclude usage of ExtendedCSS in common to prevent errors in background in the
  MV.

[1.0.10]: https://github.com/AdguardTeam/tsurlfilter/releases/tag/tswebextension-v1.0.10

## [1.0.9] - 2024-01-25

### Changed

- Correct usage of `setConfiguration`.

[1.0.9]: https://github.com/AdguardTeam/tsurlfilter/releases/tag/tswebextension-v1.0.9

## [1.0.8] - 2023-12-27

### Changed

- `webNavigation.onCommitted` event handler to take into account Opera event
firing bug.
- Updated [@adguard/tsurlfilter] to `v2.2.9`.
- Updated [@adguard/scriptlets] to `v1.9.105`.

[1.0.8]: https://github.com/AdguardTeam/tsurlfilter/releases/tag/tswebextension-v1.0.8

## [1.0.6] - 2023-12-19

### Changed

- Stealth options that are applied to the document can now be disabled by a
  `$stealth` rule [AdguardBrowserExtension#2648].

[1.0.6]: https://github.com/AdguardTeam/tsurlfilter/releases/tag/tswebextension-v1.0.6
[AdguardBrowserExtension#2648]: https://github.com/AdguardTeam/AdguardBrowserExtension/issues/2648

## [1.0.5] - 2023-12-08

### Fixed

- `Do Not Track` and `Hide Referrer from third parties` ignoring global Stealth
mode toggle.

[1.0.5]: https://github.com/AdguardTeam/tsurlfilter/releases/tag/tswebextension-v1.0.5

## [1.0.4] - 2023-12-08

### Fixed

- Session storage error in old browsers [AdguardBrowserExtension#2636].

[1.0.4]: https://github.com/AdguardTeam/tsurlfilter/releases/tag/tswebextension-v1.0.4
[AdguardBrowserExtension#2636]: https://github.com/AdguardTeam/AdguardBrowserExtension/issues/2636

## [1.0.3] - 2023-12-08

### Fixed

- Incorrect path for `typings` in `package.json`.

[1.0.3]: https://github.com/AdguardTeam/tsurlfilter/releases/tag/tswebextension-v1.0.3

## [1.0.2] - 2023-12-07

### Added

- Library version number to the exports [AdguardBrowserExtension#2237].

### Changed

- Updated [@adguard/extended-css] to `v2.0.56`.
- Updated [@adguard/tsurlfilter] to `v2.2.8`.

### Fixed

- Remove referrer from the document.referrer [AdguardBrowserExtension#1844].

[1.0.2]: https://github.com/AdguardTeam/tsurlfilter/releases/tag/tswebextension-v1.0.2
[AdguardBrowserExtension#2237]: https://github.com/AdguardTeam/AdguardBrowserExtension/issues/2237
[AdguardBrowserExtension#1844]: https://github.com/AdguardTeam/AdguardBrowserExtension/issues/1844

## [1.0.1] - 2023-12-06

### Fixed

- HTML ($$) rules break encoding on some websites [AdguardBrowserExtension#2249].

[1.0.1]: https://github.com/AdguardTeam/tsurlfilter/releases/tag/tswebextension-v1.0.1
[AdguardBrowserExtension#2249]: https://github.com/AdguardTeam/AdguardBrowserExtension/issues/2249

## [1.0.0] - 2023-12-01

### Added

- New `TsWebExtension.initStorage` method to initialize persistent values for the background script.
- New `createTsWebExtension` function to create `TsWebExtension` instance.

### Changed

- [BREAKING CHANGE] In preparation for using event-driven background scripts,
  we started using a session store to persist application context on restart.
  Since the extension session store CRUD operations are asynchronous, we added
  protection against reading the context before initialization to avoid
  unexpected behavior. Some code that depends on this restored data may be
  called before the `start` method to prepare the `configuration`, so we split
  the initialization process into two parts: the new `initStorage` method, which
  is called as soon as possible and allows access to the actual context before
  directly starting the filtering, and the `start` method, which initializes
  the filtering process.
- [BREAKING CHANGE] `TsWebExtension` constructor now accepts submodules as
  arguments. To get the `TsWebExtension` instance with `webAccessibleResources`
  param, use the new `createTsWebExtension` method.

[1.0.0]: https://github.com/AdguardTeam/tsurlfilter/releases/tag/tswebextension-v1.0.0

## [0.4.9] - 2023-11-30

### Added

- API `settings.debugScriptlets` property and `setDebugScriptlets()` method for
its setting [AdguardBrowserExtension#2584].

### Changed

- Updated [@adguard/tsurlfilter] to `v2.2.7`.
- Updated [@adguard/scriptlets] to `v1.9.101`.

[0.4.9]: https://github.com/AdguardTeam/tsurlfilter/releases/tag/tswebextension-v0.4.9
[AdguardBrowserExtension#2584]: https://github.com/AdguardTeam/AdguardBrowserExtension/issues/2584

## [0.4.8] - 2023-11-29

### Changed

- `MessageHandlerMV2` type is exported now.

[0.4.8]: https://github.com/AdguardTeam/tsurlfilter/releases/tag/tswebextension-v0.4.8

## [0.4.7] - 2023-11-21

### Fixed

- Fix cosmetic apply logging.

[0.4.7]: https://github.com/AdguardTeam/tsurlfilter/releases/tag/tswebextension-v0.4.7

## [0.4.6] - 2023-11-16

### Added

- Support for `POST` requests to `$removeparam` modifier [#99].

### Fixed

- Fix 'storage not initialized' error on extension install.

[0.4.6]: https://github.com/AdguardTeam/tsurlfilter/releases/tag/tswebextension-v0.4.6
[#99]: https://github.com/AdguardTeam/tsurlfilter/issues/99

## [0.4.5] - 2023-11-15

### Added

- Allowlist wildcard support [AdguardBrowserExtension#2020].

### Changed

- Updated [@adguard/tsurlfilter] to `v2.2.6`.
- Updated [@adguard/scriptlets] to `v1.9.96`.

[0.4.5]: https://github.com/AdguardTeam/tsurlfilter/releases/tag/tswebextension-v0.4.5
[AdguardBrowserExtension#2020]: https://github.com/AdguardTeam/AdguardBrowserExtension/issues/2020

## [0.4.4] - 2023-11-13

### Changed

- Updated [@adguard/tsurlfilter] to `v2.2.5`.
- Updated [@adguard/scriptlets] to `v1.9.91`.

[0.4.4]: https://github.com/AdguardTeam/tsurlfilter/releases/tag/tswebextension-v0.4.4

## [0.4.3] - 2023-11-09

### Fixed

- Ads displayed on the first visit on 'pikabu.ru' [AdguardBrowserExtension#2571].
- Memory leaks associated with storing refs to old filter lists in context of frames.

### Added

- Added new `ExtensionStorage`, `PersistentValueContainer`, `createExtensionStorageDecorator` interfaces
  and for restoring data in event-driven background scripts [AdguardBrowserExtension#2286].

[0.4.3]: https://github.com/AdguardTeam/tsurlfilter/releases/tag/tswebextension-v0.4.3
[AdguardBrowserExtension#2571]: https://github.com/AdguardTeam/AdguardBrowserExtension/issues/2571
[AdguardBrowserExtension#2286]: https://github.com/AdguardTeam/AdguardBrowserExtension/issues/2286

## [0.4.2] - 2023-10-17

### Fixed

- Removed grouping rules with `\r\n` for extended css rules which cause its
  error in MV3.

[0.4.2]: https://github.com/AdguardTeam/tsurlfilter/releases/tag/tswebextension-v0.4.2

## [0.4.1] - 2023-10-13

### Changed

- Updated [@adguard/tsurlfilter] to `v2.2.1`.
- Updated [@adguard/scriptlets] to `v1.9.83`.

[0.4.1]: https://github.com/AdguardTeam/tsurlfilter/releases/tag/tswebextension-v0.4.1

## [0.4.0] - 2023-10-12

### Added

- Support for $badfilter rules to Declarative Converter.

[0.4.0]: https://github.com/AdguardTeam/tsurlfilter/releases/tag/tswebextension-v0.4.0

## [0.3.22] - 2023-10-02

### Fixed

- AdGuard v4.2.168 is not working in the Firefox after update [AdguardBrowserExtension#2501].

[0.3.22]: https://github.com/AdguardTeam/tsurlfilter/releases/tag/tswebextension-v0.3.22
[AdguardBrowserExtension#2501]: https://github.com/AdguardTeam/AdguardBrowserExtension/issues/2501

## [0.3.21] - 2023-09-25

### Fixed

- Incorrect logging and applying of `$removeheader` allowlist rules.
- Proceed anyway is not working for more than two level domains [AdguardBrowserExtension#2497].

[0.3.21]: https://github.com/AdguardTeam/tsurlfilter/releases/tag/tswebextension-v0.3.21
[AdguardBrowserExtension#2497]: https://github.com/AdguardTeam/AdguardBrowserExtension/issues/2497

## [0.3.20] - 2023-09-19

### Added

- CSP `trusted-types` directive modifying for response headers [AdguardBrowserExtension#2068].

[0.3.20]: https://github.com/AdguardTeam/tsurlfilter/releases/tag/tswebextension-v0.3.20
[AdguardBrowserExtension#2068]: https://github.com/AdguardTeam/AdguardBrowserExtension/issues/2068

## [0.3.19] - 2023-09-18

### Fixed

- `$csp`, `$removeparam` and `$removeheader` allowlist rules not being published as filtering log events.
- Fixed cosmetic rules injection into a cached subdocument [AdguardBrowserExtension#2420],
  [AdguardBrowserExtension#2190], [AdguardBrowserExtension#2328].

[0.3.19]: https://github.com/AdguardTeam/tsurlfilter/releases/tag/tswebextension-v0.3.19
[AdguardBrowserExtension#2190]: https://github.com/AdguardTeam/AdguardBrowserExtension/issues/2190
[AdguardBrowserExtension#2328]: https://github.com/AdguardTeam/AdguardBrowserExtension/issues/2328
[AdguardBrowserExtension#2420]: https://github.com/AdguardTeam/AdguardBrowserExtension/issues/2420

## [0.3.18] - 2023-09-13

### Fixed

- Do not block a tab loading by `$popup` modifier rule on direct url navigation
  [AdguardBrowserExtension#2449].

[0.3.18]: https://github.com/AdguardTeam/tsurlfilter/releases/tag/tswebextension-v0.3.18
[AdguardBrowserExtension#2449]: https://github.com/AdguardTeam/AdguardBrowserExtension/issues/2449

## [0.3.17] - 2023-09-13

### Added

- New `requestUrl`, `frameUrl` and `requestType` fields in `ApplyBasicRuleEvent`.

### Fixed

- Tab title is now correctly updated on url change when the document does not
  provide it itself [AdguardBrowserExtension#2428].
- Filter id for StealthApi to display Stealth Mode cookie events in the
  Filtering Log properly [AdguardBrowserExtension#2487].

[0.3.17]: https://github.com/AdguardTeam/tsurlfilter/releases/tag/tswebextension-v0.3.17
[AdguardBrowserExtension#2428]: https://github.com/AdguardTeam/AdguardBrowserExtension/issues/2428
[AdguardBrowserExtension#2487]: https://github.com/AdguardTeam/AdguardBrowserExtension/issues/2487

## [0.3.16] - 2023-09-05

### Fixed

- Do not apply cosmetic rules to extension pages while fallback processing
  [AdguardBrowserExtension#2459].

[0.3.16]: https://github.com/AdguardTeam/tsurlfilter/releases/tag/tswebextension-v0.3.16

## [0.3.15] - 2023-09-05

### Fixed

- Redirects are not included into tab's blocked requests count [AdguardBrowserExtension#2443].

[0.3.15]: https://github.com/AdguardTeam/tsurlfilter/releases/tag/tswebextension-v0.3.15
[AdguardBrowserExtension#2443]: https://github.com/AdguardTeam/AdguardBrowserExtension/issues/2443

## [0.3.14] - 2023-09-05

### Fixed

- Domains from the allowlist are not properly escaped before being passed into
  the regular expression rules [AdguardBrowserExtension#2461].
- Cosmetic rule false positive applying when tab context changed while injection
  retry [AdguardBrowserExtension#2459].

[AdguardBrowserExtension#2459]: https://github.com/AdguardTeam/AdguardBrowserExtension/issues/2459
[AdguardBrowserExtension#2461]: https://github.com/AdguardTeam/AdguardBrowserExtension/issues/2461

[0.3.14]: https://github.com/AdguardTeam/tsurlfilter/releases/tag/tswebextension-v0.3.14

## [0.3.13] - 2023-08-25

### Changed

- Updated [@adguard/tsurlfilter] to `v2.1.11`.
- Updated [@adguard/scriptlets] to `v1.9.72`.

[0.3.13]: https://github.com/AdguardTeam/tsurlfilter/releases/tag/tswebextension-v0.3.13

## [0.3.12] - 2023-08-23

### Fixed

- Incorrect order of `onBeforeRequest` handlers.
- Blocked csp reports do not increment the blocked requests counter.

[0.3.12]: https://github.com/AdguardTeam/tsurlfilter/releases/tag/tswebextension-v0.3.12

## [0.3.11] - 2023-08-21

### Changed

- Updated [@adguard/tsurlfilter] to `v2.1.10`.
- Updated [@adguard/scriptlets] to `v1.9.70`.

### Fixed

- Applying `$cookie` rules on the content-script side.

[0.3.11]: https://github.com/AdguardTeam/tsurlfilter/releases/tag/tswebextension-v0.3.11

## [0.3.10] - 2023-08-18

### Added

- Blocking third-party requests with `csp_report` content-type.
- Handling discarded tabs replacement on wake up.

### Fixed

- Do not expose JS rules in global page scope.

[0.3.10]: https://github.com/AdguardTeam/tsurlfilter/releases/tag/tswebextension-v0.3.10

## [0.3.9] - 2023-08-10

### Changed

- Updated [@adguard/tsurlfilter] to `v2.1.7`.

[0.3.9]: https://github.com/AdguardTeam/tsurlfilter/releases/tag/tswebextension-v0.3.9

## [0.3.8] - 2023-08-04

### Changed

- Updated [@adguard/tsurlfilter] to `v2.1.6`.
- Updated [@adguard/scriptlets] to `v1.9.62`.

[0.3.8]: https://github.com/AdguardTeam/tsurlfilter/releases/tag/tswebextension-v0.3.8

## [0.3.7] - 2023-07-21

### Changed

- Updated [@adguard/tsurlfilter] to `v2.1.5`.
- Updated [@adguard/scriptlets] to `v1.9.57`.

### Fixed

- Duplicate `eventId` of filtering events.

[0.3.7]: https://github.com/AdguardTeam/tsurlfilter/releases/tag/tswebextension-v0.3.7

## [0.3.6] - 2023-07-11

### Fixed

- Rules with the `$popup` modifier were ignored and showed an incorrect dummy.
  page instead of closing the tab.
- In some cases, rules with the `$document` modifier did not show the dummy page.

[0.3.6]: https://github.com/AdguardTeam/tsurlfilter/releases/tag/tswebextension-v0.3.6

## [0.3.5] - 2023-07-11

### Fixed

- Cosmetic rule logging.

[0.3.5]: https://github.com/AdguardTeam/tsurlfilter/releases/tag/tswebextension-v0.3.5

## [0.3.4] - 2023-07-11

### Added

- Support of $elemhide, $specifichide and $generichide modifiers.

### Fixed

- Cosmetic rule matching for frames loaded from the service worker cache.

[0.3.4]: https://github.com/AdguardTeam/tsurlfilter/releases/tag/tswebextension-v0.3.4

## [0.3.3] - 2023-06-19

### Changed

- Updated [@adguard/tsurlfilter] to `v2.1.2`.

[0.3.3]: https://github.com/AdguardTeam/tsurlfilter/releases/tag/tswebextension-v0.3.3

## [0.3.2] - 2023-06-14

### Changed

- Updated [@adguard/tsurlfilter] to `v2.1.1`.

[0.3.2]: https://github.com/AdguardTeam/tsurlfilter/releases/tag/tswebextension-v0.3.2

## [0.3.1] - 2023-06-15

### Added

- new `DocumentApi` class, with frame-matching taking into account the state of the `Allowlist`.

### Changed

- `AllowlistApi` renamed to `Allowlist`. `matchFrame` method moved to `DocumentApi` class.

### Fixed

- Extra headers handling in chromium browsers.
- Filtering log update on cached pages reload.

[0.3.1]: https://github.com/AdguardTeam/tsurlfilter/releases/tag/tswebextension-v0.3.1

## [0.3.0] - 2023-06-14

### Changed

- Updated [@adguard/tsurlfilter] to `v2.1.0`.

[0.3.0]: https://github.com/AdguardTeam/tsurlfilter/releases/tag/tswebextension-v0.3.0

## [0.2.8] - 2023-06-13

### Changed

- `logLevel` configuration property type to `string`.
- `RequestContextStorage` to extend from `Map`.

### Deleted

- `record`, `find` methods and `onUpdate`, `onCreate` events from
  `RequestContextStorage`.

[0.2.8]: https://github.com/AdguardTeam/tsurlfilter/releases/tag/tswebextension-v0.2.8

## [0.2.6] - 2023-06-06

### Changed

- Updated [@adguard/scriptlets] to `v1.9.37`.

[0.2.6]: https://github.com/AdguardTeam/tsurlfilter/releases/tag/tswebextension-v0.2.6

## [0.2.5] - 2023-06-06

### Fixed

- Tab context matching for pages with cached document page.

[0.2.5]: https://github.com/AdguardTeam/tsurlfilter/releases/tag/tswebextension-v0.2.5

## [0.2.4] - 2023-06-05

### Fixed

- `hideRequestInitiatorElement` function return more accurate css selector `src`
  attribute value for first party requests.
- `ElementCollapser` inject styles via isolated style tag.

[0.2.4]: https://github.com/AdguardTeam/tsurlfilter/releases/tag/tswebextension-v0.2.4

## [0.2.3] - 2023-05-31

### Fixed

- Script rules injection.

[0.2.3]: https://github.com/AdguardTeam/tsurlfilter/releases/tag/tswebextension-v0.2.3

## [0.2.2] - 2023-05-29

### Added

- New `logLevel` optional property for MV2 configuration to control logging
  levels.

### Changed

- `verbose` MV2 configuration property is now optional.

[0.2.2]: https://github.com/AdguardTeam/tsurlfilter/releases/tag/tswebextension-v0.2.2

## [0.2.0] - 2023-05-23

### Added

- New MV2 API methods for configuration updating without engine restart:
  `setFilteringEnabled`,`setCollectHitStats`, `setStealthModeEnabled`,
  `setSelfDestructFirstPartyCookies`, `setSelfDestructThirdPartyCookies`,
  `setSelfDestructThirdPartyCookies`, `setSelfDestructFirstPartyCookiesTime`,
  `setSelfDestructThirdPartyCookiesTime`, `setHideReferrer`,
  `setHideSearchQueries`, `setBlockChromeClientData`, `setSendDoNotTrack`,
  `setBlockWebRTC`.

### Changed

- Updated `getMessageHandler` API method return type.
- `start`, `update` and `setFilteringEnabled` API methods now flush browser
  in-memory cache. This change improve filtering on pages with service workers
  and inactive tabs.

### Fixed

- Stealth module correctly sets browser privacy network settings based on
`blockWebRTC`, `stealthModeEnabled` and `filteringEnabled` options.
- unique `eventId` for `FilteringEventType.JsInject` events.

[0.2.0]: https://github.com/AdguardTeam/tsurlfilter/releases/tag/tswebextension-v0.2.0

## [0.1.4] - 2023-04-18

### Fixed

- The cookies lifetime in Stealth Mode does not apply after the engine is
  started, only after restarting.
- Incorrect work of $cookie rules: incorrect parsing of `domain` and `path`
  fields leads to errors when using browser.cookies and creating multiple
  "child" cookies for each sub-request with a more specific path, e.g. request
  to '/assets/script.js' from '/' will create a new cookie for '/assets/'.
- Wrong expirationDate for cookies.

### Added

- Applying $cookie rules to the requests before sending them to a server in the
  onBeforeSendHeaders hook.

[0.1.4]: https://github.com/AdguardTeam/tsurlfilter/releases/tag/tswebextension-v0.1.4

## [0.1.3] - 2023-04-17

### Changed

- Updated [@adguard/extended-css] to `v2.0.52`.
- Updated [@adguard/scriptlets] to `v1.9.7`.

[0.1.3]: https://github.com/AdguardTeam/tsurlfilter/releases/tag/tswebextension-v0.1.3

## [0.1.2] - 2023-04-11

### Added

- Separated export of CssHitsCounter to better tree shaking on external
  applications.

[0.1.2]: https://github.com/AdguardTeam/tsurlfilter/releases/tag/tswebextension-v0.1.2

## [0.1.1] - 2023-04-04

### Changed

- Improved injection algorithm for cosmetic rules (js and css).
  logic using the Finite State Machine to avoid double injections with
  the previous boolean flag scheme.
- Set injectScript and injectCss error to debug level.

[0.1.1]: https://github.com/AdguardTeam/tsurlfilter/releases/tag/tswebextension-v0.1.1

## [0.1.0] - 2023-03-31

### Changed

- Updated [@adguard/tsurlfilter] to `v2.0`.

[0.1.0]: https://github.com/AdguardTeam/tsurlfilter/releases/tag/tswebextension-v0.1.0

## [0.0.68] - 2023-03-24

### Added

- Described event flow scheme for webRequestModule.

### Fixed

- Changed enums according to our guideline.

[0.0.68]: https://github.com/AdguardTeam/tsurlfilter/releases/tag/tswebextension-v0.0.68

## [0.0.67] - 2023-03-23

### Fixed

- Order of injecting scripts with setDomSignal.

[0.0.67]: https://github.com/AdguardTeam/tsurlfilter/releases/tag/tswebextension-v0.0.67

## [0.0.66] - 2023-03-14

### Fixed

- Executing of html and replace rules for Firefox.

[0.0.66]: https://github.com/AdguardTeam/tsurlfilter/releases/tag/tswebextension-v0.0.66

## [0.0.65] - 2023-03-10

### Fixed

- Executing of scriptlets rules for Firefox.

### Added

- Stricter checking for non local JS rules for Firefox AMO.

[0.0.65]: https://github.com/AdguardTeam/tsurlfilter/releases/tag/tswebextension-v0.0.65

## [0.0.64] - 2023-03-10

### Changed

- Updated [@adguard/scriptlets] to `v1.9.1`.

### Fixed

- Cosmetic rules applying if CssHitsCounter is disabled.
- Mark requests from navigation from address bar as first-party requests.

[0.0.64]: https://github.com/AdguardTeam/tsurlfilter/releases/tag/tswebextension-v0.0.64

## [0.0.63] - 2023-02-17

### Changed

- Updated [@adguard/extended-css] to `v2.0.51`.

[0.0.63]: https://github.com/AdguardTeam/tsurlfilter/releases/tag/tswebextension-v0.0.63

## [0.0.62] - 2023-02-10

### Added

- Added cosmetic rules injection in tabs opened before API initialization.

### Fixed

- Fix js rule injections via WebRequest API.
- Fix extended css rule injections via content-script on API initialization.
  Content-script wait for engine start before processing.
- Fix css hit counter enabling.
  Now, it is initialized only if `collectHitStats` configuration prop is true.

[0.0.62]: https://github.com/AdguardTeam/tsurlfilter/releases/tag/tswebextension-v0.0.62

## [0.0.61] - 2023-02-07

### Added

- Support for browser.windows.onWindowFocusChanged to make browser.tabs.onActivated
  event calls work better when focus changes between windows.

[0.0.61]: https://github.com/AdguardTeam/tsurlfilter/releases/tag/tswebextension-v0.0.61

## [0.0.60] - 2023-02-03

### Changed

- Updated [@adguard/extended-css] to `v2.0.49`.

[0.0.60]: https://github.com/AdguardTeam/tsurlfilter/releases/tag/tswebextension-v0.0.60

## [0.0.59] - 2023-02-03

### Changed

- Updated [@adguard/extended-css] to `v2.0.45`.

[0.0.59]: https://github.com/AdguardTeam/tsurlfilter/releases/tag/tswebextension-v0.0.59

## [0.0.58] - 2023-02-02

### Fixed

- When opens phishing or malware site, extension will open new tab in the
  standard window with information about blocked domain and possible actions.

[0.0.58]: https://github.com/AdguardTeam/tsurlfilter/releases/tag/tswebextension-v0.0.58

## [0.0.57] - 2023-01-20

### Changed

- The order of imports to avoid side effects on tree shaking.
- Made load of AdGuard Assistant lazy to decrease size of content-script bundle.

### Fixed

- Fixed allowlist api rule generation and matching.

[0.0.57]: https://github.com/AdguardTeam/tsurlfilter/releases/tag/tswebextension-v0.0.57

## [0.0.56] - 2023-01-12

### Fixed

- Fixed simultaneous increase of package numbers for packages tsurlfilter and
  tswebextension in the branch epic.
- Fixed working with DNT-headers and GPC from stealth mode.
- Fixed js and css injection error handling.
- Fixed request events initialization.
- Fixed memory leaks in the tests.

### Removed

- Previous url from tab's metadata.

### Changes

- Merged changed from master branch.

[0.0.56]: https://github.com/AdguardTeam/tsurlfilter/releases/tag/tswebextension-v0.0.56

## [0.0.47] - 2022-12-27

### Fixed

- Allowlist rule priority.

### Added

- Simple support of `$jsonprune`.

### Removed

- Unused injectExtCss method in the CosmeticAPI.

[0.0.47]: https://github.com/AdguardTeam/tsurlfilter/releases/tag/tswebextension-v0.0.47

## [0.0.45] - 2022-12-26

### Fixed

- Recovered work of the blocking scriptlets `click2load.html`.

### Changed

- Updated [@adguard/scriptlets] to `v1.7.20`.

[0.0.45]: https://github.com/AdguardTeam/tsurlfilter/releases/tag/tswebextension-v0.0.45

## [0.0.44] - 2022-12-23

### Added

- Merged changed from master branch.

### Removed

- Support of $webrtc rules.

### Fixed

- JS and CSS injection error handling
- Request events initialization

[0.0.44]: https://github.com/AdguardTeam/tsurlfilter/releases/tag/tswebextension-v0.0.44

[@adguard/agtree]: ../agtree/CHANGELOG.md
[@adguard/logger]: ../logger/CHANGELOG.md
[@adguard/tsurlfilter]: ../tsurlfilter/CHANGELOG.md

[@adguard/assistant]: https://github.com/AdguardTeam/AdguardAssistant/blob/master/CHANGELOG.md
[@adguard/extended-css]: https://github.com/AdguardTeam/ExtendedCss/blob/master/CHANGELOG.md
[@adguard/scriptlets]: https://github.com/AdguardTeam/Scriptlets/blob/master/CHANGELOG.md
