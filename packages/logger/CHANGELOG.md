# @adguard/logger Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [2.0.0] - 2025-XX-XX

### Added

- Export of `getErrorMessage` function.

### Changed

- Now trace method is required in Writer interface.
- Channels are now called in writer as-is, e.g. without mapping 'warn' to 'info'.

[2.0.0]: https://github.com/AdguardTeam/tsurlfilter/releases/tag/logger-v2.0.0

## [1.1.1] - 2024-10-10

### Changed

- Tracing in console is collapsed by default.

[1.1.1]: https://github.com/AdguardTeam/tsurlfilter/releases/tag/logger-v1.1.1

## [1.1.0] - 2024-10-08

### Added

- New logging level `LogLevel.Trace` which works as debug but prints with call stack trace.

[1.1.0]: https://github.com/AdguardTeam/tsurlfilter/releases/tag/logger-v1.1.0

## [1.0.2] - 2024-09-23

### Fixed

- Logging methods binding to the logger instance to avoid losing the context.

[1.0.2]: https://github.com/AdguardTeam/tsurlfilter/releases/tag/logger-v1.0.2

## [1.0.1] - 2024-05-24

### Fixed

- Bug with logging `null` values [AdGuardVPNExtension#176].

[1.0.1]: https://github.com/AdguardTeam/tsurlfilter/releases/tag/logger-v1.0.1
[AdGuardVPNExtension#176]: https://github.com/AdguardTeam/AdGuardVPNExtension/issues/176
