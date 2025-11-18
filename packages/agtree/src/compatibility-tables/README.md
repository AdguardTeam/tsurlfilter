# Compatibility tables

This directory contains compatibility tables for various adblock rule features.

Table of contents:

- [Compatibility tables](#compatibility-tables)
    - [Supported categories](#supported-categories)
    - [Supported adblockers and platforms](#supported-adblockers-and-platforms)
        - [Specific platforms](#specific-platforms)
        - [Generic platforms](#generic-platforms)
        - [Combining platforms](#combining-platforms)
    - [Programmatic API](#programmatic-api)
        - [General API](#general-api)
            - [Available compatibility table instances](#available-compatibility-table-instances)
            - [Platform flags](#platform-flags)
            - [Platform expressions parser](#platform-expressions-parser)
            - [Stringify platforms bitmask to platform expression](#stringify-platforms-bitmask-to-platform-expression)
            - [Human-readable platform name](#human-readable-platform-name)
        - [Specific API](#specific-api)
            - [Redirects compatibility table](#redirects-compatibility-table)
        - [Examples](#examples)
            - [Check if a modifier is supported by any adblocker](#check-if-a-modifier-is-supported-by-any-adblocker)
            - [Check if a modifier is supported by a specific / generic platform](#check-if-a-modifier-is-supported-by-a-specific--generic-platform)
            - [Get modifier compatibility data for a specific platform](#get-modifier-compatibility-data-for-a-specific-platform)
            - [Get modifier compatibility data for a generic platform](#get-modifier-compatibility-data-for-a-generic-platform)
            - [Get all supported modifiers for a specific / generic platform](#get-all-supported-modifiers-for-a-specific--generic-platform)
            - [Get first compatible modifier for a specific / generic platform](#get-first-compatible-modifier-for-a-specific--generic-platform)
            - [Get compatibility table row](#get-compatibility-table-row)
            - [Get all modifiers grouped by product](#get-all-modifiers-grouped-by-product)

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

| Platform (ID)     | Brand                                                                                                                                                                                                                                          | Category               |
| ----------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------- |
| `adg_os_windows`  | <img src="https://cdn.adguard.com/website/github.com/AGLint/adg_logo.svg" alt="AdGuard logo" width="14px"> [AdGuard for Windows](https://adguard.com/adguard-windows/overview.html)                                                            | System-wide ad blocker |
| `adg_os_mac`      | <img src="https://cdn.adguard.com/website/github.com/AGLint/adg_logo.svg" alt="AdGuard logo" width="14px"> [AdGuard for Mac](https://adguard.com/adguard-mac/overview.html)                                                                    | System-wide ad blocker |
| `adg_os_android`  | <img src="https://cdn.adguard.com/website/github.com/AGLint/adg_logo.svg" alt="AdGuard logo" width="14px"> [AdGuard for Android](https://adguard.com/adguard-android/overview.html)                                                            | System-wide ad blocker |
| `adg_ext_chrome`  | <img src="https://cdn.adguard.com/website/github.com/AGLint/adg_logo.svg" alt="AdGuard logo" width="14px"> [AdGuard extension for Chrome](https://adguard.com/adguard-browser-extension/chrome/overview.html)                                  | Browser extension      |
| `adg_ext_opera`   | <img src="https://cdn.adguard.com/website/github.com/AGLint/adg_logo.svg" alt="AdGuard logo" width="14px"> [AdGuard extension for Opera](https://adguard.com/adguard-browser-extension/opera/overview.html)                                    | Browser extension      |
| `adg_ext_edge`    | <img src="https://cdn.adguard.com/website/github.com/AGLint/adg_logo.svg" alt="AdGuard logo" width="14px"> [AdGuard extension for Edge](https://adguard.com/adguard-browser-extension/edge/overview.html)                                      | Browser extension      |
| `adg_ext_firefox` | <img src="https://cdn.adguard.com/website/github.com/AGLint/adg_logo.svg" alt="AdGuard logo" width="14px"> [AdGuard extension for Firefox](https://adguard.com/adguard-browser-extension/firefox/overview.html)                                | Browser extension      |
| `adg_cb_android`  | <img src="https://cdn.adguard.com/website/github.com/AGLint/adg_logo.svg" alt="AdGuard logo" width="14px"> [AdGuard Content Blocker for Android](https://adguard.com/adguard-content-blocker/overview.html)                                    | Content blocker        |
| `adg_cb_ios`      | <img src="https://cdn.adguard.com/website/github.com/AGLint/adg_logo.svg" alt="AdGuard logo" width="14px"> [AdGuard Content Blocker for iOS](https://adguard.com/adguard-ios/overview.html)                                                    | Content blocker        |
| `adg_cb_safari`   | <img src="https://cdn.adguard.com/website/github.com/AGLint/adg_logo.svg" alt="AdGuard logo" width="14px"> [AdGuard Content Blocker for Safari](https://adguard.com/adguard-safari/overview.html)                                              | Content blocker        |
| `ubo_ext_chrome`  | <img src="https://cdn.adguard.com/website/github.com/AGLint/ubo_logo.svg" alt="uBlock logo" width="14px"> [uBlock Origin for Google Chrome](https://chrome.google.com/webstore/detail/ublock-origin/cjpalhdlnbpafiamejdnhcphjbkeiagm)          | Browser extension      |
| `ubo_ext_firefox` | <img src="https://cdn.adguard.com/website/github.com/AGLint/ubo_logo.svg" alt="uBlock logo" width="14px"> [uBlock Origin for Mozilla Firefox](https://addons.mozilla.org/addon/ublock-origin/)                                                 | Browser extension      |
| `ubo_ext_opera`   | <img src="https://cdn.adguard.com/website/github.com/AGLint/ubo_logo.svg" alt="uBlock logo" width="14px"> [uBlock Origin for Opera](https://addons.opera.com/extensions/details/ublock/)                                                       | Browser extension      |
| `ubo_ext_edge`    | <img src="https://cdn.adguard.com/website/github.com/AGLint/ubo_logo.svg" alt="uBlock logo" width="14px"> [uBlock Origin for Microsoft Edge](https://microsoftedge.microsoft.com/addons/detail/ublock-origin/odfafepnkmbhccpbejgmiehpchacaeak) | Browser extension      |
| `abp_ext_chrome`  | <img src="https://cdn.adguard.com/website/github.com/AGLint/abp_logo.svg" alt="Adblock Plus logo" width="14px"> [Adblock Plus for Google Chrome](https://chrome.google.com/webstore/detail/cfhdojbkjhnklbpkdaibdccddilifddb)                   | Browser extension      |
| `abp_ext_firefox` | <img src="https://cdn.adguard.com/website/github.com/AGLint/abp_logo.svg" alt="Adblock Plus logo" width="14px"> [Adblock Plus for Mozilla Firefox](https://eyeo.to/adblockplus/firefox_install/)                                               | Browser extension      |
| `abp_ext_opera`   | <img src="https://cdn.adguard.com/website/github.com/AGLint/abp_logo.svg" alt="Adblock Plus logo" width="14px"> [Adblock Plus for Opera](https://eyeo.to/adblockplus/opera_install/)                                                           | Browser extension      |
| `abp_ext_edge`    | <img src="https://cdn.adguard.com/website/github.com/AGLint/abp_logo.svg" alt="Adblock Plus logo" width="14px"> [Adblock Plus for Microsoft Edge](https://eyeo.to/adblockplus/edge_install/)                                                   | Browser extension      |

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

### Combining platforms

You can combine platforms by using the `|` operator. For example, `adg_os_any|adg_ext_firefox` means that the feature
is supported by any AdGuard OS-wide app and the AdGuard extension for Firefox.

If needed, you can also negate a platform by using the `~` operator. For example, `adg_any|~adg_safari_any` means
that the feature is supported by any AdGuard adblocker, except for AdGuard Safari-like content blockers.

## Programmatic API

Compatibility table also provides a programmatic API to access compatibility data.

### General API

#### Available compatibility table instances

We export the following compatibility table instances:

```ts
import {
  redirectsCompatibilityTable,
  scriptletsCompatibilityTable,
  modifiersCompatibilityTable,
} from '@adguard/agtree';
```

All of them provides the following methods for their respective compatibility data:

<!-- markdownlint-disable MD013 -->

| Method name | Description |
| --- | --- |
| `existsAny(name: string): boolean` | Checks whether a compatibility data `name` exists for any platform. |
| `exists(name: string, platform: SpecificPlatform \| GenericPlatform): boolean` | Checks whether a compatibility data `name` exists for a specified platform. |
| `getSingle(name: string, platform: SpecificPlatform): T \| null` | Returns a compatibility data by name and specific platform. |
| `getMultiple(name: string, platform: SpecificPlatform \| GenericPlatform): SinglePlatformRecords<T> \| null` | Returns all compatibility data records for name and specified platform. |
| `getAllMultiple(platform: SpecificPlatform \| GenericPlatform): SinglePlatformRecords<T>[]` | Returns all compatibility data records for the specified platform. |
| `getFirst(name: string, platform: SpecificPlatform \| GenericPlatform): T \| null` | Returns the first compatibility data record for name and specified platform. |
| `getRow(name: string): T[]` | Returns all compatibility data records for the specified name. |
| `getRowsByProduct(): RowsByProduct<T>` | Returns all compatibility data records grouped by product. |

<!-- markdownlint-enable MD013 -->

All methods based on the name of the entity and the platform.

#### Platform flags

The `SpecificPlatform` and `GenericPlatform` enums are used to specify the platform in the API methods.
These enums represents bit flags, so you can combine them on demand.

```ts
import { SpecificPlatform, GenericPlatform } from '@adguard/agtree';
```

#### Platform expressions parser

Parses a raw platform expression into a platform flag.

```ts
import { parseRawPlatforms } from '@adguard/agtree';

parseRawPlatforms('adg_os_windows|ubo_ext_chrome');
```

#### Stringify platforms bitmask to platform expression

Stringifies a platform flag into a raw platform expression.

```ts
import { stringifyPlatforms } from '@adguard/agtree';

stringifyPlatforms(SpecificPlatform.AdgOsWindows | GenericPlatform.UboExtChrome); // 'adg_os_windows|ubo_ext_chrome'
```

#### Human-readable platform name

Converts a platform flag into a human-readable platform name.

```ts
import { getHumanReadablePlatformName } from '@adguard/agtree';

getHumanReadablePlatformName(SpecificPlatform.AdgOsWindows); // 'AdGuard for Windows'
```

### Specific API

#### Redirects compatibility table

<!-- markdownlint-disable MD013 -->

| Method name | Description |
| --- | --- |
| `getResourceTypeModifiers(redirect: string \| RedirectDataSchema platform: SpecificPlatform \| GenericPlatform)` | Get all supported resource type modifiers for a specific redirect. |

<!-- markdownlint-enable MD013 -->

### Examples

In this section, we provide examples of how to use the compatibility table API.
Examples are based on the `modifiersCompatibilityTable` instance, but you can use the same API for other tables.

#### Check if a modifier is supported by any adblocker

If you want to check if the `$third-party` modifier is supported by any AdGuard adblocker,
you can use the following code:

```ts
import { modifiersCompatibilityTable } from '@adguard/agtree';

modifiersCompatibilityTable.existsAny('third-party');
```

#### Check if a modifier is supported by a specific / generic platform

If you want to check if the `$third-party` modifier is supported by any AdGuard OS-wide app
or the AdGuard extension for Firefox, you can use the following code:

```ts
import { modifiersCompatibilityTable, SpecificPlatform, parseRawPlatforms } from '@adguard/agtree';

modifiersCompatibilityTable.exists('third-party', GenericPlatform.AdgOsAny | SpecificPlatform.AdgExtFirefox);
// or you can use the `parseRawPlatforms` helper function if you prefer raw platform expressions:
modifiersCompatibilityTable.exists('third-party', parseRawPlatforms('adg_os_any|adg_ext_firefox'));
```

#### Get modifier compatibility data for a specific platform

If you want to get all compatibility data for the `$third-party` modifier for AdGuard Extension for Chrome,
you can use the following code:

```ts
import { modifiersCompatibilityTable, SpecificPlatform } from '@adguard/agtree';

modifiersCompatibilityTable.getSingle('third-party', SpecificPlatform.AdgExtChrome);
```

this will returns all compatibility data for the `$third-party` modifier for AdGuard Extension for Chrome:

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

You can get any field from the compatibility data object you need.

Of course, if you specify some non-existent modifier, the method will return `null`.

#### Get modifier compatibility data for a generic platform

If you want to get all compatibility data for the `$third-party` modifier for any AdGuard browser extension,
you can use the following code:

```ts
import { modifiersCompatibilityTable, SpecificPlatform } from '@adguard/agtree';

modifiersCompatibilityTable.getMultiple('third-party', GenericPlatform.AdgExtAny);
```

this will returns an object where keys are specific platforms and values are compatibility data for the `$third-party`
modifier:

```js
{
  // 8 = SpecificPlatform.AdgExtChrome
  '8': {
    name: 'third-party',
    aliases: [ '3p' ],
    description: 'A restriction of third-party and own requests.\n' +
      'A third-party request is a request from a different domain.\n' +
      'For example, a request to `example.org` from `domain.com` is a third-party request.',
    docs: 'https://adguard.app/kb/general/ad-filtering/create-own-filters/#third-party-modifier',
    // ...
  },
  // 16 = SpecificPlatform.AdgExtOpera
  '16': {
    name: 'third-party',
    // ...
  },
  // 32 = SpecificPlatform.AdgExtEdge
  '32': {
    name: 'third-party',
    // ...
  },
  // 64 = SpecificPlatform.AdgExtFirefox
  '64': {
    name: 'third-party',
    // ...
  }
}
```

#### Get all supported modifiers for a specific / generic platform

If you want to get all supported modifiers for AdGuard OS-wide app for Windows, you can use the following code:

```ts
import { modifiersCompatibilityTable, SpecificPlatform } from '@adguard/agtree';

modifiersCompatibilityTable.getAllMultiple(SpecificPlatform.AdgOsWindows);
```

This will return an array of compatible modifiers for AdGuard OS-wide app for Windows.

This method also works for generic platforms, for example, to get all supported modifiers for
any AdGuard OS-wide app, you can use the following code:

```ts
modifiersCompatibilityTable.getAllMultiple(GenericPlatform.AdgOsAny);
```

#### Get first compatible modifier for a specific / generic platform

As you've seen in the previous example, there are multiple compatible modifiers for a generic platform,
but sometimes you may need only the first compatible modifier.

If you want to get the first compatible modifier for AdGuard OS-wide app for Windows, you can use the following code:

```ts
import { modifiersCompatibilityTable, SpecificPlatform } from '@adguard/agtree';

modifiersCompatibilityTable.getFirst('third-party', SpecificPlatform.AdgOsWindows);
```

#### Get compatibility table row

Sometimes you may need to get all compatibility data for a specific modifier, redirect, or scriptlet.
Lets say you want to get all compatibility data for the `$third-party` modifier:

```ts
import { modifiersCompatibilityTable } from '@adguard/agtree';

modifiersCompatibilityTable.getRow('third-party');
```

this will returns all compatibility data for the `$third-party` modifier:

```js
[
  {
    name: 'third-party',
    aliases: [ '3p' ],
    docs: 'https://adguard.app/kb/general/ad-filtering/create-own-filters/#third-party-modifier',
    // ...
  },
  {
    name: '3p',
    aliases: [ 'third-party' ],
    docs: 'https://github.com/gorhill/uBlock/wiki/Static-filter-syntax#3p',
    // ...
  },
  {
    name: 'third-party',
    aliases: null,
    docs: 'https://help.adblockplus.org/hc/en-us/articles/360062733293#party-requests',
    // ...
  }
]
```

As you can see, `aliases` and `docs` fields are different for each platform.

#### Get all modifiers grouped by product

If you want to get all compatibility data grouped by product, you can use the following code:

```ts
import { modifiersCompatibilityTable } from '@adguard/agtree';

modifiersCompatibilityTable.getRowsByProduct();
```

This will returns an array where each element is an object that represents compatibility data for a given modifier.

```js
[
  {
    AdGuard: {
      // key are platform flags
      '1': [Object],
      '2': [Object],
      // ...
    },
    UblockOrigin: {
      // key are platform flags
      '1024': [Object],
      '2048': [Object],
      '4096': [Object],
      '8192': [Object]
    },
    // seems its not compatible with AdblockPlus
    AdblockPlus: {}
  },
  // ...
]
```

Practically, we use this function to generate compatibility tables in the WIKI.
