# AdGuard Diff Builder

A tool for generating differential updates for filter lists.

- [How to install](#how-to-install)
- [How to use](#how-to-use)
   - [Use as CLI](#cli)
   - [Use as API](#api)
- [Algorithm](#algorithm)

## How to install

`yarn add @adguard/diff-builder`

## How to Use

## CLI

```bash
diff-builder build [-c] [-d <seconds>] [-r <resolution>] [-v] -n <name> -t <expirationPeriod> <old_filter> <new_filter> <path_to_patches>
```

Where:

- `<old_filter>` — the relative path to the old filter.
- `<new_filter>` — the relative path to the new filter.
- `<path_to_patches>` — the relative path to the directory with patches.
- `-n <name>` or `--name=<name>` — name of the patch file, an arbitrary string to identify the patch.
  Must be a string of length 1-64 with no spaces or other special characters.
- `-r <timestampResolution>` or `--resolution=<timestampResolution>` — is an optional flag,
  that specifies the resolution for both `expirationPeriod` and `epochTimestamp` (timestamp when the patch was generated).
  Possible values:
    - `h` — hours (used if `resolution` is not specified)
    - `m` — minutes
    - `s` — seconds
- `-t <expirationPeriod>` or `--time=<expirationPeriod>` — expiration time for the diff update
  (the unit depends on `resolution` parameter).
- `-d <seconds>` or `--delete-older-than-sec=<seconds>` — an optional parameter,
  this time *in seconds* will be used when scanning the `<path_to_patches>` folder to remove patches,
  which not empty and whose created epoch timestamp is older than the specified time.
  By default, it will be `604800` (7 days).
- `-v` or `--verbose` — verbose mode.
- `-c` or `--checksum` — an optional flag, indicating whether it should calculate the SHA sum for the filter
  and add it to the `diff` directive with the filter name and the number of changed lines,
  following this format: `diff name:[name] checksum:[checksum] lines:[lines]`:
    - `name` — the name of the corresponding filter list.
      This key-value pair is optional — it will be included only if there is a `Diff-Name` tag in the `<old_filter>`.
    - `checksum` — the expected SHA1 checksum of the file after the patch is applied.
      This is used to validate the patch.
    - `lines` — the number of lines that follow, making up the RCS diff block.
      Note that `lines` are counted using the same algorithm as used by `wc -l`, essentially counting `\n`.

## Algorithm Overview

### 1. Setup
   - Resolve absolute paths for the old and new filters and the patches directory.

### 2. Prepare Patch Directory
   - Ensure the patches directory exists, creating it if necessary.

### 3. Clean Up Old Patches
   - Delete any outdated patches from the patches directory except empty patches.

### 4. Read Filters and Detect Changes
   - Read and split the old and new filter files into lines.
   - Check if there are significant changes between the two sets of lines, excluding 'Diff-Path' and 'Checksum' tags.

### 5. Handle No Changes
   - If no significant changes are found, revert any changes in the new filter and exit.

### 6. Process Changes
   - Generate a new patch name and validate its uniqueness.
   - Update the 'Diff-Path' tag in the new filter.
   - Create a diff patch between the old and new filters.
   - Optionally, add a checksum to the patch.

### 7. Finalize
   - Write the updated new filter back to its file.
   - Create an empty patch file for future use if necessary.
   - Save the diff patch to the appropriate file.


## API

### CJS

```javascript
const { DiffBuilder } = require('@adguard/diff-builder');
const { DiffUpdater } = require('@adguard/diff-builder/diff-updater');

await DiffBuilder.buildDiff({
   oldFilterPath,
   newFilterPath,
   patchesPath,
   name,
   time,
   resolution,
   verbose: true,
});

const updatedFilter = await DiffUpdater.applyPatch({
    filterUrl,
    filterContent,
    verbose: true,
});
```

### ESM

```javascript
import { DiffBuilder } from '@adguard/diff-builder/es';
import { DiffUpdater } from '@adguard/diff-builder/diff-updater/es';

await DiffBuilder.buildDiff({
   oldFilterPath,
   newFilterPath,
   patchesPath,
   name,
   time,
   resolution,
   verbose: true,
});

const updatedFilter = await DiffUpdater.applyPatch({
    filterUrl,
    filterContent,
    verbose: true,
});
```
