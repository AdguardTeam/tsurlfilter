# Diff Builder Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).


## [1.0.17] - 2024-03-25

### Added

- Throwing of `UnacceptableResponseError` by `DiffUpdater.applyPatch()`
  if response status is unacceptable [AdguardBrowserExtension#2717].

[AdguardBrowserExtension#2717]: https://github.com/AdguardTeam/AdguardBrowserExtension/issues/2717
[1.0.17]: https://github.com/AdguardTeam/DiffBuilder/compare/v1.0.16...v1.0.17


## [1.0.16] - 2024-03-18

### Fixed

- Checking validity of builded patch.

[1.0.16]: https://github.com/AdguardTeam/DiffBuilder/compare/v1.0.13...v1.0.16


## [1.0.13] - 2024-01-17

### Changed

- Use forked `diff` package.

[1.0.13]: https://github.com/AdguardTeam/DiffBuilder/compare/v1.0.12...v1.0.13


## [1.0.12] - 2024-01-17

### Changed

- Throw error when response status for network request is invalid.

[1.0.12]: https://github.com/AdguardTeam/DiffBuilder/compare/v1.0.11...v1.0.12


## [1.0.11] - 2024-01-16

### Fixed

- Do not delete a patch if it is empty.

### Added

- Validating for generated patch.

## Changed

- Write generated patch to folder with new filter.

[1.0.11]: https://github.com/AdguardTeam/DiffBuilder/compare/v1.0.10...v1.0.11


## [1.0.10] - 2024-01-11

### Fixed

- Deleting outdated patches.
- Fixed line endings in updated tags.

[1.0.10]: https://github.com/AdguardTeam/DiffBuilder/compare/v1.0.9...v1.0.10


## [1.0.9] - 2024-01-08

### Fixed

- Use last available version of `jsdiff` to fix error with large patches.

[1.0.9]: https://github.com/AdguardTeam/DiffBuilder/compare/v1.0.8...v1.0.9


## [1.0.8] - 2023-12-29

### Changed

- Use fetch instead of axios for file urls

[1.0.8]: https://github.com/AdguardTeam/DiffBuilder/compare/v1.0.7...v1.0.8


## [1.0.7] - 2023-12-29

### Fixed

- Handle backslashes '\' for Windows file paths.

[1.0.7]: https://github.com/AdguardTeam/DiffBuilder/compare/v1.0.6...v1.0.7


## [1.0.6] - 2023-12-26

### Fixed

- Handle user agent headers in the filter content.

[1.0.6]: https://github.com/AdguardTeam/DiffBuilder/compare/v1.0.5...v1.0.6


## [1.0.5] - 2023-12-25

### Fixed

- Bug with cutting filter content to first 50 lines.

[1.0.5]: https://github.com/AdguardTeam/DiffBuilder/compare/v1.0.4...v1.0.5


## [1.0.4] - 2023-12-25

### Changed

- The algorithm has been modified to ignore changes in the 'Diff-Path' and
  'Checksum' tags, but it now accounts for the presence of the 'Checksum' tag
  in the new file and recalculates it if necessary. Additionally, cases where
  two checksums are present in a file have been considered, and the algorithm
  has been simplified accordingly.

[1.0.4]: https://github.com/AdguardTeam/DiffBuilder/compare/v1.0.3...v1.0.4


## [1.0.3] - 2023-12-20

### Fixed

- Recalculate only first found checksum.

[1.0.3]: https://github.com/AdguardTeam/DiffBuilder/compare/v1.0.2...v1.0.3


## [1.0.2] - 2023-12-20

### Fixed

- Recalculating checksum of the new filter after adding Diff-Path tag.

[1.0.2]:  https://github.com/AdguardTeam/DiffBuilder/compare/v1.0.1...v1.0.2
