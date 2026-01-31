# Dnr-rulesets

Utility to load prebuilt AdGuard DNR rulesets for mv3 extensions.

The list of available filters can be found by `filters` in the metadata of:
- [Chromium MV3 filters](https://filters.adtidy.org/extension/chromium-mv3/filters.json),
- [Opera MV3 filters](https://filters.adtidy.org/extension/opera-mv3/filters.json).

- [Dnr-rulesets](#dnr-rulesets)
    - [Basic usage](#basic-usage)
        - [CLI](#cli)
        - [API](#api)
        - [Output structure](#output-structure)
        - [Utils](#utils)
            - [getVersion](#getversion)
            - [getVersionTimestampMs](#getversiontimestampms)
    - [Advanced usage](#advanced-usage)
        - [Injecting rulesets to the manifest object](#injecting-rulesets-to-the-manifest-object)
    - [Example](#example)
    - [Included filter lists](#included-filter-lists)
    - [Development](#development)
        - [build:assets](#buildassets)
        - [build:lib](#buildlib)
        - [build:cli](#buildcli)
        - [build:docs](#builddocs)
        - [build](#build)

## Basic usage

Install package.

> NOTE: To update filters in time, make sure you have the latest version of the package installed.

```bash
npm install --save-dev @adguard/dnr-rulesets
```

### CLI

1. Add scripts to your `package.json` to load DNR rulesets and patch extension manifest.

```json
{
    "scripts": {
        "load-dnr-rulesets": "dnr-rulesets load <path-to-output>",
        "patch-manifest": "dnr-rulesets manifest <path-to-manifest> <path-to-filters>"
    }
}
```

Available commands:

#### `load` command

Downloads and saves DNR rulesets to the specified directory.
```bash
dnr-rulesets load <path-to-output>
```

**Options for `load` command:**

- `-l, --latest-filters` - download latest text filters instead of DNR rulesets (default: false)
- `-b, --browser <browser>` - specify browser to load filters for (default: "chromium-mv3"). Available browsers: `chromium-mv3`, `opera-mv3`.

#### `manifest` command

Patches the extension manifest to include DNR rulesets.
```bash
dnr-rulesets manifest <path-to-manifest> <path-to-filters> [options]
```

**Options for `manifest` command:**

- `-f, --force-update` - force update rulesets with existing id (default: false)
- `-i, --ids <ids...>` - filters ids to append, others will be ignored (default: [] - append all)
- `-e, --enable <ids...>` - enable filters by default (default: [])
- `-r, --ruleset-prefix <prefix>` - prefix for filters ids (default: "ruleset_")
- `-m, --filters-match <match>` - filters files match glob pattern (default: "filter_+([0-9]).txt")

**Note about array options**: For options that accept multiple values (`ids` and `enable`), use please following syntax:

```bash
--ids=1,2
```

#### `watch` command

Watches for changes in the filter files and rebuilds DNR rulesets.
```bash
dnr-rulesets watch <path-to-manifest> <path-to-resources> [options]
```

**Arguments:**
- `<path-to-manifest>` - path to the manifest.json file
- `<path-to-resources>` - folder with resources to build $redirect rules (can be obtained via `@adguard/tswebextension war` command)

**Options for `watch` command:**

- `-p, --path-to-filters` - path to filters and i18n metadata file (default: `./filters` relative to manifest folder)
- `-o, --output-path-for-rulesets` - output path for rulesets (default: `./filters/declarative` relative to manifest folder)
- `-f, --force-update` - force update rulesets with existing id (default: true)
- `-i, --ids <ids...>` - filters ids to process, others will be ignored (default: [] - process all filters matched via `--filters-match`)
- `-e, --enable <ids...>` - enable filters by default in manifest.json (default: [])
- `-r, --ruleset-prefix <prefix>` - prefix for filters ids (default: "ruleset_")
- `-m, --filters-match <match>` - filters files match glob pattern (default: "filter_+([0-9]).txt")
- `-l, --latest-filters` - download latest text filters on first start before watch (default: false)
- `-b, --browser <browser>` - specify browser to download latest filters for (default: "chromium-mv3"). See `--latest-filters` option. Available browsers: `chromium-mv3`, `opera-mv3`.
- `-d, --debug` - enable extended logging during conversion (default: false)
- `-j, --prettify-json` - prettify JSON output (default: true)

### `exclude-unsafe-rules` command

Scans rulesets in the specified directory, excludes unsafe rules, and saves
excluded unsafe rules to the metadata files, and update rulesets checksums.

```bash
dnr-rulesets exclude-unsafe-rules <dir> [options]
```

**Arguments:**
- `<dir>`: Path to the folder containing rulesets to process.

**Options:**
- `-j, --prettify-json <bool>`: Prettify JSON output (`true` or `false`, default: `true`)
- `-l, --limit <number>`: Limit the number of unsafe rules to exclude. If the number of unsafe rules exceeds this limit, the command will throw an error.

**Example:**
```bash
dnr-rulesets exclude-unsafe-rules ./filters/declarative --prettify-json false --limit 100
```


**Note about array options**: For options that accept multiple values (`ids` and `enable`), use please following syntax:

```bash
--ids=1,2
```

1. Run the script to load DNR rulesets as part of your build flow.

```bash
npm run load-dnr-rulesets
```

1. Patch your extension manifest to include DNR rulesets.

```bash
npm run patch-manifest
```

### API

You can also integrate functions for downloading and updating the manifest into your build script:

1. Load DNR rulesets.

    This method copies prebuilt assets to the specified output directory, including:
    - DNR rulesets in JSON format for all available filters
    - `filters_i18n.json` - translations file with filter names and descriptions
    - `local_script_rules.js` - local script rules file in JS module format for
    Manifest v3 extensions where it is highly recommended to provide local script rules. If not provided during build, all script rules (except scriptlets) will not be injected to ensure compliance with Chrome Web Store policies.
    - `local_script_rules.json` - local script rules in JSON format for Manifest v2. If not provided, all script rules are treated as allowed. Should be provided in Firefox AMO according to their policies.

    ```ts
    import { AssetsLoader, BrowserFilters } from '@adguard/dnr-rulesets';

    const loader = new AssetsLoader();
    await loader.load('<path-to-output>', options);
    ```

    where `options` is an object with the following properties:

    ```ts
    export type AssetsLoaderOptions = {
        /**
         * Whether to download latest text filters instead of DNR rulesets.
        */
        latestFilters?: boolean;

        /**
         * For which browser load assets for.
        * Default value: `BrowserFilters.ChromiumMV3`.
        */
        browser?: BrowserFilters;
    };
    ```

2. Copy only local script rules.

    **Option A: Copy JavaScript format rules**

    ```ts
    import { AssetsLoader, BrowserFilters } from '@adguard/dnr-rulesets';

    const loader = new AssetsLoader();
    await loader.copyLocalScriptRulesJs('<path-to-output>', BrowserFilters.ChromiumMv3);
    ```

    This method copies only the `local_script_rules.js` file to the specified destination directory.

    **Option B: Copy JSON format rules**

    ```ts
    import { AssetsLoader, BrowserFilters } from '@adguard/dnr-rulesets';

    const loader = new AssetsLoader();
    await loader.copyLocalScriptRulesJson('<path-to-output>', BrowserFilters.ChromiumMv3);
    ```

    This method copies only the `local_script_rules.json` file to the specified destination directory.

3. Extend local script rules with custom rules.

    **Option A: Using `extendLocalScriptRulesJs`** (Manifest V3)

    ```ts
    import { AssetsLoader } from '@adguard/dnr-rulesets';

    const loader = new AssetsLoader();
    await loader.extendLocalScriptRulesJs(
        '<path-to-local-script-rules.js>',
        [
            'example.com#%#const ad = document.querySelector(".ad"); ad.remove();',
            'example.org#%#console.log("Custom script");'
        ]
    );
    ```

    This method parses custom filtering rules, extracts JavaScript injection rules from them, and appends them to an existing `local_script_rules.js` file. It's useful for dynamically adding custom JS rules to your extension at build time.

    **Option B: Using `extendLocalScriptRulesJson`** (Manifest V2)

    ```ts
    import { AssetsLoader } from '@adguard/dnr-rulesets';

    const loader = new AssetsLoader();
    await loader.extendLocalScriptRulesJson(
        '<path-to-local-script-rules.json>',
        [
            'example.com#%#const ad = document.querySelector(".ad"); ad.remove();',
            'example.org,~sub.example.org#%#console.log("Custom script");'
        ]
    );
    ```

    This method parses custom filtering rules, extracts JavaScript injection rules with their domain configurations (both permitted and restricted domains), and merges them into an existing `local_script_rules.json` file. Use this method when you need to maintain domain-specific rule associations.

    > **Note:** The `extendLocalScriptRulesJs` and `extendLocalScriptRulesJson` methods are only available in the programmatic API and not in the CLI. These methods require programmatic access to parse and manipulate existing local script rule files, which is more suitable for build scripts and custom automation workflows rather than command-line usage.

4. Patch extension manifest.

    ```ts
    import { ManifestPatcher } from '@adguard/dnr-rulesets';

    const patcher = new ManifestPatcher();

    patcher.patch(
        '<path-to-manifest>',
        '<path-to-filters>',
        {
            // Optional: specify filter IDs to include
            ids: ['2', '3'],
            // Optional: specify enabled filter IDs
            enabled: ['2'],
            // Optional: set to true to overwrite existing rulesets
            forceUpdate: true,
            // Optional: set prefix for ruleset paths
            rulesetPrefix: 'ruleset_',
            // Optional: specify filter files matching glob pattern
            filtersMatch: 'filter_+([0-9]).txt',
        },
    )
    ```

Also you can call to `excludeUnsafeRules` in your custom build flows or automation scripts.

```ts
import { excludeUnsafeRules } from '@adguard/dnr-rulesets';

await excludeUnsafeRules('<path-to-rulesets-dir>', {
    prettifyJson: true, // optional
    limit: 100,         // optional
});
```


### Output structure

```bash
/
    |
    |filters
        |
        |<browser>
            |
            |declarative
            |   |
            |   |ruleset_0
            |   |   |
            |   |   |ruleset_0.json # This is special ruleset which stores metadata about all other rulesets
            |   |
            |   |ruleset_<id>
            |       |
            |       |ruleset_<id>.json # DNR ruleset converted from filter_<id>.txt
            |
            |filter_i18n.json # i18n metadata (name, description, etc.) for filters
```

Where `<browser>` is the browser for which the rulesets are built, e.g. `chromium-mv3` or `opera-mv3`.

### Utils

The package provides a set of utility functions for working with DNR rulesets.

#### `getVersion()`

Returns the version of the package.

```ts
import { getVersion } from '@adguard/dnr-rulesets/utils';

const dnrRulesetsVersion = getVersion();
```

#### `getVersionTimestampMs()`

Returns the timestamp of the dnr-rulesets build, based on the patch version,
or current timestamp of the function call if date and time is not present in the patch version.

```ts
import { getVersionTimestampMs } from '@adguard/dnr-rulesets/utils';

const dnrRulesetsBuildTimestamp = getVersionTimestampMs();
```

## Advanced usage

### Injecting rulesets to the manifest object

We also provide flexible API to apply rulesets to the manifest object.
It can be useful if you want to patch to the manifest while bundling.

```ts
import { RulesetsInjector } from '@adguard/dnr-rulesets';

const injector = new RulesetsInjector();

const manifest = {
    // Your manifest data
};

const ManifestWithRulesets = injector.applyRulesets(
    (id) => `<path to rulesets>/${id}.json`,
    manifest,
    ['2', '3'],
    {
        // Optional: specify filter IDs to include
        ids: ['2', '3'],
        // Optional: specify enabled filter IDs
        enabled: ['2'],
        // Optional: set to true to overwrite existing rulesets
        forceUpdate: true,
        // Optional: set prefix for ruleset paths
        rulesetPrefix: 'ruleset_',
    },
);
```

## Example

Example of usage: [adguard-api-mv3](../examples/adguard-api-mv3)

## Included filter lists

See the list of included filters in [FILTERS.md](FILTERS.md).

## Development

### `build:assets`

Downloads original rules, converts it to DNR rule sets via [TSUrlFilter declarative-converter](../tsurlfilter/README.md#declarativeconverter) and generates extension manifest with predefined rules resources.

```bash
pnpm build:assets
```

### `build:lib`

Builds SDK to load DNR rule sets to the specified directory.

```bash
pnpm build:lib
```

### `build:cli`

Builds CLI utility to load DNR rule sets to the specified directory, inject rulesets to the manifest object and can be used for local development for DNR rulesets.

```bash
pnpm build:cli
```

### `build:docs`

Generates [Included filter lists](#included-filter-lists) section.

```bash
pnpm build:docs
```

### `build`

Clears `dist` folder and runs `build:assets`, `build:cli` and `build:lib` scripts.

```bash
pnpm build
```

### `watch`
Watches for changes in the `dist/filters` folder and rebuilds DNR rulesets.

```bash
pnpm watch
```
