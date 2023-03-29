# Changelog
All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.0.67] - 2023-03-23

### Fixed
- Order of injecting scripts with setDomSignal.


## [0.0.66] - 2023-03-14

### Fixed
- Executing of html and replace rules for Firefox


## [0.0.65] - 2023-03-10

### Fixed
- Executing of scriptlets rules for Firefox

### Added
- Stricter checking for non local JS rules for Firefox AMO


## [0.0.64] - 2023-03-10

### Changed
- Updated `@adguard/scriptlets` to `v1.9.1`

### Fixed
- Cosmetic rules applying if CssHitsCounter is disabled
- Mark requests from navigation from address bar as first-party requests.


## [0.0.63] - 2023-02-17

### Changed
- Updated `@adguard/extended-css` to `v2.0.51`


## [0.0.62] - 2023-02-10

### Added
- Added cosmetic rules injection in tabs opened before API initialization
### Fixed
- Fix js rule injections via WebRequest API.
- Fix extended css rule injections via content-script on API initialization.
  Content-script wait for engine start before processing.
- Fix css hit counter enabling.
  Now, it is initialized only if `collectHitStats` configuration prop is true.


## [0.0.61] - 2023-02-07

### Added
- Support for browser.windows.onWindowFocusChanged to make browser.tabs.onActivated
  event calls work better when focus changes between windows.


## [0.0.60] - 2023-02-03

### Changed
- Updated `@adguard/extended-css` to `v2.0.49`


## [0.0.59] - 2023-02-03

### Changed
- Updated `@adguard/extended-css` to `v2.0.45`


## [0.0.58] - 2023-02-02

### Fixed
- When opens phishing or malware site, extension will open new tab in the
  standard window with information about blocked domain and possible actions.


## [0.0.57] - 2023-01-20

### Changed
- The order of imports to avoid side effects on tree shaking.
- Made load of AdGuard Assistant lazy to decrease size of content-script bundle.

### Fixed
- Fixed allowlist api rule generation and matching


## [0.0.56] - 2023-01-12

### Fixed
- Fixed simultaneous increase of package numbers for packages tsurlfilter and
  tswebextension in the branch epic
- Fixed working with DNT-headers and GPC from stealth mode
- Fixed js and css injection error handling
- Fixed request events initialization
- Fixed memory leaks in the tests

### Removed
- Previous url from tab's metadata

### Changes

- Merged changed from master branch


## [0.0.47] - 2022-12-27

### Fixed

- Allowlist rule priority

### Added

- Simple support of `$jsonprune`

### Removed

- Unused injectExtCss method in the CosmeticAPI


## [0.0.45] - 2022-12-26

### Fixed
- Recovered work of the blocking scriptlets `click2load.html`

### Changed
- Updated `@adguard/scriptlets` to `v1.7.20`


## [0.0.44] - 2022-12-23

### Added

- Merged changed from master branch

### Removed

- Support of $webrtc rules

### Fixed

- JS and CSS injection error handling
- Request events initialization

