# Changelog
All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).


## [0.0.64]

### Fixed
- Cosmetic rules applying if CssHitsCounter is disabled


## [0.0.63]

### Changed
- Updated `@adguard/extended-css` to `v2.0.51`


## [0.0.62]

### Added
- Added cosmetic rules injection in tabs opened before API initialization
### Fixed
- Fix js rule injections via WebRequest API.
- Fix extended css rule injections via content-script on API initialization.
  Content-script wait for engine start before processing.
- Fix css hit counter enabling.
  Now, it is initialized only if `collectHitStats` configuration prop is true.


## [0.0.61]

### Added
- Support for browser.windows.onWindowFocusChanged to make browser.tabs.onActivated
  event calls work better when focus changes between windows.


## [0.0.60]

### Changed
- Updated `@adguard/extended-css` to `v2.0.49`


## [0.0.59]

### Changed
- Updated `@adguard/extended-css` to `v2.0.45`


## [0.0.58]

### Fixed
- When opens phishing or malware site, extension will open new tab in the
  standard window with information about blocked domain and possible actions.


## [0.0.57]

### Changed
- The order of imports to avoid side effects on tree shaking.
- Made load of AdGuard Assistant lazy to decrease size of content-script bundle.

### Fixed
- Fixed allowlist api rule generation and matching


## [0.0.56]

### Fixed
- Fixed simultaneous increase of package numbers for packages tsurlfilter and
  tswebextension in the branch epic


## [0.0.55]

### Fixed
- Fixed working with DNT-headers and GPC from stealth mode


## [0.0.54]

### Fixed
- Fix js and css injection error handling
- Fix request events initialization

## [0.0.54]
## [0.0.53]

- No changes for tswebextension, the package number has been updated
  by mistake in bamboo plans


## [0.0.52]

### Fixed
- Memory leaks in the tests


## [0.0.51]

### Removed
- Previous url from tab's metadata


## [0.0.50]

### Changes

- Merged changed from master branch


## [0.0.49]

### Changes

- Merged changed from master branch


## [0.0.48]

### Changes

- Merged changed from master branch


## [0.0.47]

### Fixed

- Allowlist rule priority


## [0.0.46]

### Added

- Simple support of `$jsonprune`

### Removed

- Unused injectExtCss method in the CosmeticAPI


## [0.0.45]

### Fixed
- Recovered work of the blocking scriptlets `click2load.html`

### Changed
- Updated `@adguard/scriptlets` to `v1.7.20`


## [0.0.44]

### Added

- Merged changed from master branch


## [0.0.43]

### Removed

- Support of $webrtc rules


## [0.0.42]

### Fixed

- JS and CSS injection error handling
- Request events initialization
