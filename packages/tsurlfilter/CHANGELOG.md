# TSUrlFilter Changelog
All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).


## v1.0.78

### Changed

- Improved the way rule domains are parsed


## v1.0.77

### Changed

- Updated Scriptlets to v1.9.1


## v1.0.76

### Fixed

- Avoid cases where two `CssHitsCounter`s try to append and remove the same elements one after another


## v1.0.75

### Changed

- Updated ExtendedCss to v2.0.51


## v1.0.74

### Changed

- Updated ExtendedCss to v2.0.49


## v1.0.73

### Changed

- Updated ExtendedCss to v2.0.45


## v1.0.70

### Changed

- Updated Scriptlets to v1.8.2


## v1.0.68

### Added

- Simple support of `$hls` modifier — just for compiler validation

### Changed

- Removed unnecessary brackets for unknown pseudo-class validation error


## v1.0.67

### Added

- Simple support of `$jsonprune` modifier — just for compiler validation

### Changed

- Improved selector validation unknown pseudo-class error


## v1.0.66

### Removed

- Support of $webrtc modifier


## v1.0.65

### Changed

- Updated ExtendedCss to v2.0.33
- Updated Scriptlets to v1.7.19


## v1.0.64

### Changed

- Updated Scriptlets to v1.7.14


## v1.0.63

### Changed

- Updated Scriptlets to v1.7.13


## v1.0.62

### Changed

- Always consider `:has()` pseudo-class as extended


## v1.0.59

### Changed

- Updated ExtendedCss to v2.0.26


## v1.0.57

### Changed

- Updated ExtendedCss to v2.0.24
- Updated Scriptlets to v1.7.10

### Removed

- `:if()` and `:if-not()` pseudo-classes
