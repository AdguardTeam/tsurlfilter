# ExtendedCss Changelog

## [2.0.56]

### Fixed
- Path to declarations bundle.

## [2.0.55]

### Added
- Library version number to the exports [#2237](https://github.com/AdguardTeam/AdguardBrowserExtension/issues/2237).


## v2.0.52

### Added

- A guard when initializing in an unsupported browser

### Changed

- Improved throttling algorithm for applying rules
- Deleted deprecated fallback for observing the document DOM


## v2.0.51

### Changed

- Property `content` of `style` in `rules` of API type `IAffectedElement` is marked as optional [#163](https://github.com/AdguardTeam/ExtendedCss/issues/163)


## v2.0.49

### Fixed

- error on `BeforeStyleAppliedCallback` type checking


## v2.0.45

### Fixed

- type checking for `BeforeStyleAppliedCallback`


## v2.0.44

### Added

- `cssRules` property to `ExtCssConfiguration` for array of separated CSS rules
- `init()` public method for ExtendedCss initialization on a page

### Changed

- increase versions of supported browsers
    - Chrome — 88
    - Firefox — 84
    - Edge — 88
    - Safari — 14
- instead of throwing the error in unsupported browser, log it
- disallow only Internet Explorer as unsupported browser [#161](https://github.com/AdguardTeam/ExtendedCss/issues/161)


## v2.0.33

### Changed

- parse `:not()` and `:is()` pseudo-class with no extended selector arg as standard

### Fixed

- parsing of `:has()` pseudo-class selector list argument


## v2.0.26

### Fixed

- `:matches-css()` with pseudo-element
- headless puppeteer testcases run


## v2.0.24

### Fixed

- parsing of attribute selectors


## v2.0.22

### Fixed

- remove rules printing in browser-extension filtering log
- CssHitsCounter `content` style applying to selected elements

### Removed

- `:if()` and `:if-not()` pseudo-classes [#151](https://github.com/AdguardTeam/ExtendedCss/issues/151)


## v2.0.18

### Fixed

- parsing of attribute selectors to allow no-value attributes with escaped quotes
- default export entry point for IIFE scripts used for debugging
- deploy of dist to GitHub Pages on release


## v2.0.15

### Fixed

- parsing of attribute selectors to allow escaped backslash at start of attribute


## v2.0.12

### Fixed

- parsing of attribute selectors


## v2.0.10

### Fixed

- public method `validate()` for `:remove()` pseudo-class, not defined `getComputedStyle` and `XPathResult`, and selector started with combinator
- parsing of:
    - attribute selectors
    - regexp pattern pseudo-class args
    - tab inside attribute value
    - attribute in compound selectors after extended pseudo-class


## v2.0.7

### Fixed

- elements selecting by `:not()` and `:is()` pseudo-classes

### Changed

- error logging for public method `validate()`


## v2.0.5

### Fixed

- parsing of standard selector attributes and proper `:xpath()` pseudo-class position


## v2.0.2

### Fixed

- selectors with case-insensitive attribute [#104](https://github.com/AdguardTeam/ExtendedCss/issues/104)
- parsing of `:xpath()` pseudo-class argument [#106](https://github.com/AdguardTeam/ExtendedCss/issues/106)
- `:upward()` and `:nth-ancestor()` pseudo-classes are no longer supposed to be the last on selector [#111](https://github.com/AdguardTeam/ExtendedCss/issues/111)
- applying of `:not(:has(...))` combination [#141](https://github.com/AdguardTeam/ExtendedCss/issues/141)
- performance for some pseudo-class combinations [#136](https://github.com/AdguardTeam/ExtendedCss/issues/136)

### Added

- `::first-line` and other pseudo-element support by `:matches-css()` pseudo-class [#150](https://github.com/AdguardTeam/ExtendedCss/issues/150)

### Changed

- whole approach to selector parsing [#110](https://github.com/AdguardTeam/ExtendedCss/issues/110)
- syntax of `:matches-css()` pseudo-class due to various pseudo-elements support
- browser console output for debug mode [#128](https://github.com/AdguardTeam/ExtendedCss/issues/128)
