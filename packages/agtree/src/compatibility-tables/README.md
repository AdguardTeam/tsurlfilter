# Compatibility tables

This directory contains compatibility tables for various adblock rule features.

Table of contents:

- [Compatibility tables](#compatibility-tables)
    - [Supported categories](#supported-categories)
    - [Supported adblockers and platforms](#supported-adblockers-and-platforms)
        - [Specific platforms](#specific-platforms)
        - [Generic platforms](#generic-platforms)
        - [Platform expressions](#platform-expressions)
    - [Programmatic API](#programmatic-api)
        - [Platform class](#platform-class)
        - [PlatformExpressionEvaluator](#platformexpressionevaluator)
        - [Compatibility Tables API](#compatibility-tables-api)
        - [Usage Examples](#usage-examples)
            - [Check if a feature exists](#check-if-a-feature-exists)
            - [Check if a feature is supported by a platform](#check-if-a-feature-is-supported-by-a-platform)
            - [Get compatibility data for a specific platform](#get-compatibility-data-for-a-specific-platform)
            - [Query first matching platform](#query-first-matching-platform)
            - [Query all matching platforms](#query-all-matching-platforms)
            - [Get all features for a platform](#get-all-features-for-a-platform)
            - [Get all platform variants](#get-all-platform-variants)
            - [Group features by product](#group-features-by-product)

## Supported categories

Currently, the following categories are supported. Each category has its own compatibility table:

- [Rule modifiers][modifiers-table] ([Extended version][modifiers-table-extended])
- [Redirect resources][redirects-table]
- [Scriptlet resources][scriptlets-table]
- (Extended) CSS pseudo-classes :construction:

Please note that certain things, such as syntax or rule categories, cannot be handled by the compatibility table.
This is simply because they rarely change, and would also require a high level of abstraction, so it is much easier
to manage them at a low level, at the parser / converter level. The compatibility table mainly covers features that
are well abstracted and common to several adblockers, just with different implementations. For example, network rule
modifiers or CSS selectors are used by all adblockers, but with different functionality.

[modifiers-table]: ./wiki/modifiers-compatibility-table.md
[modifiers-table-extended]: ./wiki/modifiers-compatibility-table-extended.md
[redirects-table]: ./wiki/redirects-compatibility-table.md
[scriptlets-table]: ./wiki/scriptlets-compatibility-table.md

## Supported adblockers and platforms

Currently we support the following adblockers:

<!-- markdownlint-disable MD013 -->
- <img src="https://cdn.adguard.com/website/github.com/AGLint/adg_logo.svg" alt="AdGuard logo" width="14px"> AdGuard (`adg`)
- <img src="https://cdn.adguard.com/website/github.com/AGLint/ubo_logo.svg" alt="uBlock logo" width="14px"> uBlock Origin (`ubo`)
- <img src="https://cdn.adguard.com/website/github.com/AGLint/abp_logo.svg" alt="Adblock Plus logo" width="14px"> AdBlock / Adblock Plus (`abp`)
<!-- markdownlint-enable MD013 -->

However, there may also be compatibility differences within a brand due to the specificities and limitations of each
platform. For example:

- AdGuard content blockers doesn't support CSS injection, while the AdGuard browser extension does. This is because the
  API of a content blocker does not allow this, while a modern browser extension allows stylesheet injection.
- AdGuard Chrome extension doesn't support HTML filtering, while the Firefox extension does. This is simply because
  Chrome's API does not provide this level of network-level filtering, while Firefox's does.
- etc.

Therefore, we need to specify the platform for each adblocker to cover all the edge cases.

### Specific platforms

The following specific platforms are supported:

<!-- markdownlint-disable MD013 -->

| Platform (ID)         | Brand                                                                                                                                                                                                                                          | Category               |
| --------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------- |
| `adg_os_windows`      | <img src="https://cdn.adguard.com/website/github.com/AGLint/adg_logo.svg" alt="AdGuard logo" width="14px"> [AdGuard for Windows](https://adguard.com/adguard-windows/overview.html)                                                            | System-wide ad blocker |
| `adg_os_mac`          | <img src="https://cdn.adguard.com/website/github.com/AGLint/adg_logo.svg" alt="AdGuard logo" width="14px"> [AdGuard for Mac](https://adguard.com/adguard-mac/overview.html)                                                                    | System-wide ad blocker |
| `adg_os_android`      | <img src="https://cdn.adguard.com/website/github.com/AGLint/adg_logo.svg" alt="AdGuard logo" width="14px"> [AdGuard for Android](https://adguard.com/adguard-android/overview.html)                                                            | System-wide ad blocker |
| `adg_os_linux`        | <img src="https://cdn.adguard.com/website/github.com/AGLint/adg_logo.svg" alt="AdGuard logo" width="14px"> AdGuard for Linux                                                                                                                   | System-wide ad blocker |
| `adg_ext_chrome`      | <img src="https://cdn.adguard.com/website/github.com/AGLint/adg_logo.svg" alt="AdGuard logo" width="14px"> [AdGuard extension for Chrome](https://adguard.com/adguard-browser-extension/chrome/overview.html)                                  | Browser extension      |
| `adg_ext_opera`       | <img src="https://cdn.adguard.com/website/github.com/AGLint/adg_logo.svg" alt="AdGuard logo" width="14px"> [AdGuard extension for Opera](https://adguard.com/adguard-browser-extension/opera/overview.html)                                    | Browser extension      |
| `adg_ext_edge`        | <img src="https://cdn.adguard.com/website/github.com/AGLint/adg_logo.svg" alt="AdGuard logo" width="14px"> [AdGuard extension for Edge](https://adguard.com/adguard-browser-extension/edge/overview.html)                                      | Browser extension      |
| `adg_ext_firefox`     | <img src="https://cdn.adguard.com/website/github.com/AGLint/adg_logo.svg" alt="AdGuard logo" width="14px"> [AdGuard extension for Firefox](https://adguard.com/adguard-browser-extension/firefox/overview.html)                                | Browser extension      |
| `adg_ext_chrome_mv3`  | <img src="https://cdn.adguard.com/website/github.com/AGLint/adg_logo.svg" alt="AdGuard logo" width="14px"> AdGuard extension for Chrome (Manifest V3)                                                                                          | Browser extension      |
| `adg_ext_firefox_mv3` | <img src="https://cdn.adguard.com/website/github.com/AGLint/adg_logo.svg" alt="AdGuard logo" width="14px"> AdGuard extension for Firefox (Manifest V3)                                                                                         | Browser extension      |
| `adg_ext_opera_mv3`   | <img src="https://cdn.adguard.com/website/github.com/AGLint/adg_logo.svg" alt="AdGuard logo" width="14px"> AdGuard extension for Opera (Manifest V3)                                                                                           | Browser extension      |
| `adg_ext_edge_mv3`    | <img src="https://cdn.adguard.com/website/github.com/AGLint/adg_logo.svg" alt="AdGuard logo" width="14px"> AdGuard extension for Edge (Manifest V3)                                                                                            | Browser extension      |
| `adg_cb_android`      | <img src="https://cdn.adguard.com/website/github.com/AGLint/adg_logo.svg" alt="AdGuard logo" width="14px"> [AdGuard Content Blocker for Android](https://adguard.com/adguard-content-blocker/overview.html)                                    | Content blocker        |
| `adg_cb_ios`          | <img src="https://cdn.adguard.com/website/github.com/AGLint/adg_logo.svg" alt="AdGuard logo" width="14px"> [AdGuard Content Blocker for iOS](https://adguard.com/adguard-ios/overview.html)                                                    | Content blocker        |
| `adg_cb_safari`       | <img src="https://cdn.adguard.com/website/github.com/AGLint/adg_logo.svg" alt="AdGuard logo" width="14px"> [AdGuard Content Blocker for Safari](https://adguard.com/adguard-safari/overview.html)                                              | Content blocker        |
| `ubo_ext_chrome`      | <img src="https://cdn.adguard.com/website/github.com/AGLint/ubo_logo.svg" alt="uBlock logo" width="14px"> [uBlock Origin for Google Chrome](https://chrome.google.com/webstore/detail/ublock-origin/cjpalhdlnbpafiamejdnhcphjbkeiagm)          | Browser extension      |
| `ubo_ext_firefox`     | <img src="https://cdn.adguard.com/website/github.com/AGLint/ubo_logo.svg" alt="uBlock logo" width="14px"> [uBlock Origin for Mozilla Firefox](https://addons.mozilla.org/addon/ublock-origin/)                                                 | Browser extension      |
| `ubo_ext_opera`       | <img src="https://cdn.adguard.com/website/github.com/AGLint/ubo_logo.svg" alt="uBlock logo" width="14px"> [uBlock Origin for Opera](https://addons.opera.com/extensions/details/ublock/)                                                       | Browser extension      |
| `ubo_ext_edge`        | <img src="https://cdn.adguard.com/website/github.com/AGLint/ubo_logo.svg" alt="uBlock logo" width="14px"> [uBlock Origin for Microsoft Edge](https://microsoftedge.microsoft.com/addons/detail/ublock-origin/odfafepnkmbhccpbejgmiehpchacaeak) | Browser extension      |
| `ubo_ext_chrome_mv3`  | <img src="https://cdn.adguard.com/website/github.com/AGLint/ubo_logo.svg" alt="uBlock logo" width="14px"> uBlock Origin for Google Chrome (Manifest V3)                                                                                        | Browser extension      |
| `ubo_ext_firefox_mv3` | <img src="https://cdn.adguard.com/website/github.com/AGLint/ubo_logo.svg" alt="uBlock logo" width="14px"> uBlock Origin for Mozilla Firefox (Manifest V3)                                                                                      | Browser extension      |
| `ubo_ext_opera_mv3`   | <img src="https://cdn.adguard.com/website/github.com/AGLint/ubo_logo.svg" alt="uBlock logo" width="14px"> uBlock Origin for Opera (Manifest V3)                                                                                                | Browser extension      |
| `ubo_ext_edge_mv3`    | <img src="https://cdn.adguard.com/website/github.com/AGLint/ubo_logo.svg" alt="uBlock logo" width="14px"> uBlock Origin for Microsoft Edge (Manifest V3)                                                                                       | Browser extension      |
| `abp_ext_chrome`      | <img src="https://cdn.adguard.com/website/github.com/AGLint/abp_logo.svg" alt="Adblock Plus logo" width="14px"> [Adblock Plus for Google Chrome](https://chrome.google.com/webstore/detail/cfhdojbkjhnklbpkdaibdccddilifddb)                   | Browser extension      |
| `abp_ext_firefox`     | <img src="https://cdn.adguard.com/website/github.com/AGLint/abp_logo.svg" alt="Adblock Plus logo" width="14px"> [Adblock Plus for Mozilla Firefox](https://eyeo.to/adblockplus/firefox_install/)                                               | Browser extension      |
| `abp_ext_opera`       | <img src="https://cdn.adguard.com/website/github.com/AGLint/abp_logo.svg" alt="Adblock Plus logo" width="14px"> [Adblock Plus for Opera](https://eyeo.to/adblockplus/opera_install/)                                                           | Browser extension      |
| `abp_ext_edge`        | <img src="https://cdn.adguard.com/website/github.com/AGLint/abp_logo.svg" alt="Adblock Plus logo" width="14px"> [Adblock Plus for Microsoft Edge](https://eyeo.to/adblockplus/edge_install/)                                                   | Browser extension      |

<!-- markdownlint-enable MD013 -->

### Generic platforms

For simplicity, we introduced the concept of "generic platforms" that represent a group of specific platforms.
This is useful when we want to specify compatibility for a group of platforms, but not for all of them.

<!-- markdownlint-disable MD013 -->

| Generic platform (ID) | Description                                                                         | Equivalent to (shortcut or platform)                            |
| --------------------- | ----------------------------------------------------------------------------------- | --------------------------------------------------------------- |
| `any`                 | Any adblocker, any platform                                                         | `adg_any`, `ubo_any`, `abp_any`                                 |
| `adg_any`             | Any AdGuard adblocker                                                               | `adg_os_any`, `adg_ext_any`, `adg_safari_any`, `adg_cb_android` |
| `adg_os_any`          | Any AdGuard OS-wide app (using [CoreLibs](https://github.com/AdguardTeam/CoreLibs)) | `adg_os_windows`, `adg_os_mac`, `adg_os_android`                |
| `adg_ext_any`         | Any AdGuard browser extension                                                       | `adg_ext_chromium`, `adg_ext_firefox`                           |
| `adg_ext_chromium`    | AdGuard browser extension for Chromium-based browsers\*                             | `adg_ext_chrome`, `adg_ext_opera`, `adg_ext_edge`               |
| `adg_safari_any`      | Any AdGuard Safari-like content blocker                                             | `adg_cb_ios`, `adg_cb_safari`                                   |
| `ubo_any`             | Any uBlock Origin browser extension                                                 | `ubo_ext_any`                                                   |
| `ubo_ext_any`         | Any uBlock Origin browser extension                                                 | `ubo_ext_chromium`, `ubo_ext_firefox`                           |
| `ubo_ext_chromium`    | uBlock Origin browser extension for Chromium-based browsers\*                       | `ubo_ext_chrome`, `ubo_ext_opera`, `ubo_ext_edge`               |
| `abp_any`             | Any Adblock Plus browser extension                                                  | `abp_ext_any`                                                   |
| `abp_ext_any`         | Any Adblock Plus browser extension                                                  | `abp_ext_chromium`, `abp_ext_firefox`                           |
| `abp_ext_chromium`    | Adblock Plus browser extension for Chromium-based browsers\*                        | `abp_ext_chrome`, `abp_ext_opera`, `abp_ext_edge`               |

<!-- markdownlint-enable MD013 -->

\* Chromium-based browsers include Google Chrome, Microsoft Edge, Opera, Brave, Vivaldi, etc. See more details
[here](<https://en.wikipedia.org/wiki/Chromium_(web_browser)>).

### Platform expressions

Platform expressions allow you to specify multiple platforms or exclude specific ones using simple operators:

- **`|` (OR operator):** Combine multiple platforms. Example: `adg_os_any|ubo_ext_chrome` means AdGuard OS apps OR
  uBlock Origin for Chrome.
- **`~` (NOT operator):** Exclude specific platforms. Example: `adg_any|~adg_cb_ios` means all AdGuard products
  EXCEPT AdGuard Content Blocker for iOS.

These expressions are commonly used in compatibility data YAML files to define feature support across multiple
platforms.

## Programmatic API

The programmatic API provides a type-safe way to query compatibility data using hierarchical platform queries.

### Platform class

The `Platform` class represents a hierarchical platform identifier with three levels:

1. **Product** (`adg`, `ubo`, `abp`, or `any`): The adblocker product
2. **Type** (`os`, `ext`, `cb`, or `any`): The platform type (OS app, browser extension, content blocker)
3. **Specific** (e.g., `windows`, `chrome`, `ios`): The specific platform variant

Each level can be wildcarded using `any` or omitted to create generic queries that match multiple platforms.

```ts
import { Platform } from '@adguard/agtree';

// Specific platform: matches exactly one platform
Platform.AdgOsWindows    // { product: 'adg', type: 'os', specific: 'windows' }

// Type wildcard: matches all platforms of this product and type
Platform.AdgOsAny        // { product: 'adg', type: 'os', specific: undefined }
                         // Matches: AdgOsWindows, AdgOsMac, AdgOsLinux, AdgOsAndroid

// Product wildcard: matches all platforms of this product
Platform.AdgAny          // { product: 'adg', type: undefined, specific: undefined }
                         // Matches: all AdGuard platforms

// Full wildcard: matches any platform
Platform.Any             // { product: 'any', type: undefined, specific: undefined }
```

**Key platform methods:**

<!-- markdownlint-disable MD013 -->

| Method | Description |
| --- | --- |
| `parse(str: string): Platform` | Parse platform string (e.g., `'adg_os_windows'`) |
| `toString(): string` | Convert to string (e.g., `'adg_os_windows'`) |
| `matches(target: Platform): boolean` | Check if this platform matches target (wildcard matching) |
| `isWildcard: boolean` | Check if platform contains wildcards |
| `toHumanReadable(): string` | Get human-readable name |
| `getAllConcretePlatforms(): Platform[]` | Get all non-wildcard platforms |

<!-- markdownlint-enable MD013 -->

### PlatformExpressionEvaluator

For complex platform expressions with negation and wildcard expansion, use `PlatformExpressionEvaluator`:

```ts
import { PlatformExpressionEvaluator } from '@adguard/agtree';

// Evaluate expression with negation
const platforms = PlatformExpressionEvaluator.evaluate('adg_any|~adg_cb_ios');
// Returns: Array of all AdGuard platforms except adg_cb_ios

// Optimize platform lists (collapse to wildcards when possible)
const optimized = PlatformExpressionEvaluator.optimize([
  Platform.AdgOsWindows,
  Platform.AdgOsMac,
  Platform.AdgOsLinux,
  Platform.AdgOsAndroid
]);
// Returns: [Platform.AdgOsAny] (all OS platforms present, collapsed to wildcard)
```

**Key features:**

- **Wildcard expansion:** Expands wildcards like `adg_any` to all concrete AdGuard platforms
- **Negation support:** Excludes specific platforms using `~` operator
- **Optimization:** Collapses concrete platforms into wildcards when all members are present
- **Validation:** Throws errors for invalid platform names or malformed expressions

### Compatibility Tables API

We export three compatibility table instances:

```ts
import {
  modifiersCompatibilityTable,
  redirectsCompatibilityTable,
  scriptletsCompatibilityTable,
} from '@adguard/agtree';
```

All tables extend `CompatibilityTableBase` and provide the same core methods:

<!-- markdownlint-disable MD013 -->

| Method | Description |
| --- | --- |
| `has(name: string): boolean` | Check if feature exists for any platform |
| `supports(name: string, platform: Platform): boolean` | Check if feature is supported on platform |
| `get(name: string, platform: Platform): T \| null` | Get data for specific platform (no wildcards) |
| `query(name: string, platform: Platform): T \| null` | Query first matching data (handles wildcards) |
| `queryAll(name: string, platform: Platform): T[]` | Query all matching data (handles wildcards) |
| `getAll(platform: Platform): Map<string, T[]>` | Get all features for platform |
| `getAllVariants(name: string): T[]` | Get all platform variants of feature |
| `groupByProduct(): Map<AdblockProduct, Map<string, T[]>>` | Group all features by product |

<!-- markdownlint-enable MD013 -->

**Additional methods:**

- **`modifiersCompatibilityTable`:** No additional methods
- **`redirectsCompatibilityTable`:** `getResourceTypeModifiers(redirect, platform)` - Get supported resource type
  modifiers
- **`scriptletsCompatibilityTable`:** No additional methods

### Usage Examples

The following examples demonstrate the compatibility tables API using `modifiersCompatibilityTable`. The same methods
work identically for `redirectsCompatibilityTable` and `scriptletsCompatibilityTable` - just replace the table instance
and feature names.

#### Check if a feature exists

Check if the `$third-party` modifier exists for any platform:

```ts
import { modifiersCompatibilityTable } from '@adguard/agtree';

modifiersCompatibilityTable.has('third-party');  // true
```

#### Check if a feature is supported by a platform

Check if the `$third-party` modifier is supported by AdGuard for Windows:

```ts
import { modifiersCompatibilityTable, Platform } from '@adguard/agtree';

// Using predefined platforms
modifiersCompatibilityTable.supports('third-party', Platform.AdgOsWindows);  // true

// Using platform parser
modifiersCompatibilityTable.supports('third-party', Platform.parse('adg_os_windows'));  // true

// Check wildcard (any AdGuard OS)
modifiersCompatibilityTable.supports('third-party', Platform.AdgOsAny);  // true
```

#### Get compatibility data for a specific platform

Get compatibility data for the `$third-party` modifier on AdGuard Extension for Chrome:

```ts
import { modifiersCompatibilityTable, Platform } from '@adguard/agtree';

const data = modifiersCompatibilityTable.get('third-party', Platform.AdgExtChrome);
```

This returns the compatibility data object:

```js
{
  name: 'third-party',
  aliases: [ '3p' ],
  description: 'A restriction of third-party and own requests.\n' +
    'A third-party request is a request from a different domain.\n' +
    'For example, a request to `example.org` from `domain.com` is a third-party request.',
  docs: 'https://adguard.app/kb/general/ad-filtering/create-own-filters/#third-party-modifier',
  versionAdded: null,
  versionRemoved: null,
  deprecated: false,
  deprecationMessage: null,
  removed: false,
  removalMessage: null,
  conflicts: null,
  inverseConflicts: false,
  assignable: false,
  negatable: true,
  blockOnly: false,
  exceptionOnly: false,
  valueOptional: false,
  valueFormat: null
}
```

If the feature doesn't exist for that platform, the method returns `null`.

#### Query first matching platform

When querying with wildcards, you might only need the first result:

```ts
import { modifiersCompatibilityTable, Platform } from '@adguard/agtree';

// Find first AdGuard extension that supports $third-party
const first = modifiersCompatibilityTable.query('third-party', Platform.AdgExtAny);
// Returns the first matching ModifierData or null
```

#### Query all matching platforms

Get compatibility data for all AdGuard browser extensions (wildcard query):

```ts
import { modifiersCompatibilityTable, Platform } from '@adguard/agtree';

const results = modifiersCompatibilityTable.queryAll('third-party', Platform.AdgExtAny);
```

This returns an array of compatibility data for all matching platforms:

```js
[
  {
    name: 'third-party',
    aliases: [ '3p' ],
    description: 'A restriction of third-party and own requests.\n' +
      'A third-party request is a request from a different domain.\n' +
      'For example, a request to `example.org` from `domain.com` is a third-party request.',
    docs: 'https://adguard.app/kb/general/ad-filtering/create-own-filters/#third-party-modifier',
    // ... (AdGuard Chrome)
  },
  {
    name: 'third-party',
    // ... (AdGuard Opera)
  },
  {
    name: 'third-party',
    // ... (AdGuard Edge)
  },
  {
    name: 'third-party',
    // ... (AdGuard Firefox)
  }
]
```

#### Get all features for a platform

Get all modifiers supported by AdGuard for Windows:

```ts
import { modifiersCompatibilityTable, Platform } from '@adguard/agtree';

const features = modifiersCompatibilityTable.getAll(Platform.AdgOsWindows);
// Returns: Map<string, ModifierData[]>
// e.g., Map {
//   'third-party' => [ModifierData],
//   'domain' => [ModifierData],
//   'important' => [ModifierData],
//   ...
// }
```

This also works for wildcard queries to get all features across multiple platforms:

```ts
// Get all modifiers for any AdGuard OS
const osFeatures = modifiersCompatibilityTable.getAll(Platform.AdgOsAny);
```

#### Get all platform variants

Get all platform-specific variants of a feature:

```ts
import { modifiersCompatibilityTable } from '@adguard/agtree';

const variants = modifiersCompatibilityTable.getAllVariants('third-party');
```

This returns all compatibility data across all platforms:

```js
[
  {
    name: 'third-party',
    aliases: [ '3p' ],
    docs: 'https://adguard.app/kb/general/ad-filtering/create-own-filters/#third-party-modifier',
    // ... (AdGuard)
  },
  {
    name: '3p',
    aliases: [ 'third-party' ],
    docs: 'https://github.com/gorhill/uBlock/wiki/Static-filter-syntax#3p',
    // ... (uBlock Origin)
  },
  {
    name: 'third-party',
    aliases: null,
    docs: 'https://help.adblockplus.org/hc/en-us/articles/360062733293#party-requests',
    // ... (Adblock Plus)
  }
]
```

Note that `aliases` and `docs` fields differ between platforms.

#### Group features by product

Get all features grouped by adblocker product:

```ts
import { modifiersCompatibilityTable, AdblockProduct } from '@adguard/agtree';

const grouped = modifiersCompatibilityTable.groupByProduct();
// Returns: Map<AdblockProduct, Map<string, ModifierData[]>>

// Access AdGuard-specific modifiers
const adgModifiers = grouped.get(AdblockProduct.Adg);
// Returns: Map<string, ModifierData[]> with all AdGuard modifiers

// Access uBlock Origin-specific modifiers
const uboModifiers = grouped.get(AdblockProduct.Ubo);
```

This is useful for generating product-specific compatibility tables or documentation.
