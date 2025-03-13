# Dnr-rulesets

Utility to load prebuilt AdGuard DNR rulesets for mv3 extensions.

The list of available filters can be found by `filters` in [the metadata](https://filters.adtidy.org/extension/chromium-mv3/filters.json).

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
        - [Ad Blocking](#ad-blocking)
        - [AdGuard Base filter](#adguard-base-filter)
        - [AdGuard Mobile Ads filter](#adguard-mobile-ads-filter)
        - [AdGuard Quick Fixes filter](#adguard-quick-fixes-filter)
        - [Privacy](#privacy)
        - [AdGuard Tracking Protection filter](#adguard-tracking-protection-filter)
        - [AdGuard URL Tracking filter](#adguard-url-tracking-filter)
        - [Social Widgets](#social-widgets)
        - [AdGuard Social Media filter](#adguard-social-media-filter)
        - [Annoyances](#annoyances)
        - [AdGuard Cookie Notices filter](#adguard-cookie-notices-filter)
        - [AdGuard Popups filter](#adguard-popups-filter)
        - [AdGuard Mobile App Banners filter](#adguard-mobile-app-banners-filter)
        - [AdGuard Other Annoyances filter](#adguard-other-annoyances-filter)
        - [AdGuard Widgets filter](#adguard-widgets-filter)
        - [Security](#security)
        - [Online Malicious URL Blocklist](#online-malicious-url-blocklist)
        - [Phishing URL Blocklist](#phishing-url-blocklist)
        - [Scam Blocklist by DurableNapkin](#scam-blocklist-by-durablenapkin)
        - [uBlock Origin – Badware risks](#ublock-origin--badware-risks)
        - [Other](#other)
        - [AdGuard Experimental filter](#adguard-experimental-filter)
        - [Filter unblocking search ads and self-promotion](#filter-unblocking-search-ads-and-self-promotion)
        - [Language-specific](#language-specific)
        - [AdGuard Russian filter](#adguard-russian-filter)
        - [AdGuard German filter](#adguard-german-filter)
        - [AdGuard Japanese filter](#adguard-japanese-filter)
        - [AdGuard Dutch filter](#adguard-dutch-filter)
        - [AdGuard Spanish/Portuguese filter](#adguard-spanishportuguese-filter)
        - [AdGuard Turkish filter](#adguard-turkish-filter)
        - [AdGuard French filter](#adguard-french-filter)
        - [AdGuard Ukrainian filter](#adguard-ukrainian-filter)
        - [Bulgarian list](#bulgarian-list)
        - [EasyList Czech and Slovak](#easylist-czech-and-slovak)
        - [EasyList Hebrew](#easylist-hebrew)
        - [EasyList Italy](#easylist-italy)
        - [EasyList Lithuania](#easylist-lithuania)
        - [Latvian List](#latvian-list)
        - [Liste AR](#liste-ar)
        - [AdBlockID](#adblockid)
        - [EasyList Thailand](#easylist-thailand)
        - [Hungarian filter](#hungarian-filter)
        - [ABPVN List](#abpvn-list)
        - [Official Polish filters for AdBlock, uBlock Origin \& AdGuard](#official-polish-filters-for-adblock-ublock-origin--adguard)
        - [Polish GDPR-Cookies Filters](#polish-gdpr-cookies-filters)
        - [Estonian List](#estonian-list)
        - [AdGuard Chinese filter](#adguard-chinese-filter)
        - [List-KR](#list-kr)
        - [Adblock List for Finland](#adblock-list-for-finland)
        - [Persian Blocker](#persian-blocker)
        - [Polish Anti Adblock Filters](#polish-anti-adblock-filters)
        - [Frellwit's Swedish Filter](#frellwits-swedish-filter)
        - [Dandelion Sprout's Nordic Filters](#dandelion-sprouts-nordic-filters)
        - [Dandelion Sprout's Serbo-Croatian List](#dandelion-sprouts-serbo-croatian-list)
        - [IndianList](#indianlist)
        - [Macedonian adBlock Filters](#macedonian-adblock-filters)
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
        "patch-manifest": "dnr-rulesets manifest <path-to-manifest> <path-to-output>"
    }
}
```

`patch-manifest` command also provide two options:

- `-f, --force-update` - force update rulesets with existing id (default: false)
- `-i, --ids <ids...>` - filters ids to append (default: [])
- `-e, --enable <ids...>` - enable filters by default (default: [])
- `-r, --ruleset-prefix <prefix>` - prefix for filters ids (default: "ruleset_")
- `-m, --filters-match <match>` - filters files match glob pattern (default: "filter_+([0-9]).txt")

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

    ```ts
    import { AssetsLoader } from '@adguard/dnr-rulesets';

    const loader = new AssetsLoader();
    await loader.load('<path-to-output>');
    ```

2. Patch extension manifest.

    ```ts
    import { ManifestPatcher } from '@adguard/dnr-rulesets';

    const patcher = new ManifestPatcher();

    patcher.path(
        '<path-to-manifest>',
        '<path-to-output>',
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

### Output structure

```bash
/
|
|declarative
|   |
|   |ruleset_<id>
|       |
|       |ruleset_<id>.json // DNR ruleset converted from filter_<id>.txt
|       |metadata.json // Ruleset metadata with source mapping
|       |lazy_Metadata.json // Additional ruleset metadata for lazy loading
|
|filter_<id>.txt // Original filter rules with specified id
```

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

### Ad Blocking

#### AdGuard Base filter

EasyList + AdGuard English filter. This filter is necessary for quality ad blocking.

- Filter ID: **2**
- Path: `<filters-directory>/declarative/ruleset_2/ruleset_2.json`

#### AdGuard Mobile Ads filter

Filter for all known mobile ad networks. Useful for mobile devices.

- Filter ID: **11**
- Path: `<filters-directory>/declarative/ruleset_11/ruleset_11.json`

#### AdGuard Quick Fixes filter

**IMPORTANT:** This filter is not convertible (excluded from build), but it is still included in the metadata. It should be downloaded from the server on the client and applied dynamically.

Filter to quickly resolve content filtering issues on popular websites without updating the extension.

- Filter ID: **24**

### Privacy

#### AdGuard Tracking Protection filter

The most comprehensive list of various online counters and web analytics tools. Use this filter if you do not want your actions on the Internet to be tracked.

- Filter ID: **3**
- Path: `<filters-directory>/declarative/ruleset_3/ruleset_3.json`

#### AdGuard URL Tracking filter

Filter that enhances privacy by removing tracking parameters from URLs.

- Filter ID: **17**
- Path: `<filters-directory>/declarative/ruleset_17/ruleset_17.json`

### Social Widgets

#### AdGuard Social Media filter

Filter for social media widgets such as 'Like' and 'Share' buttons and more.

- Filter ID: **4**
- Path: `<filters-directory>/declarative/ruleset_4/ruleset_4.json`

### Annoyances

#### AdGuard Cookie Notices filter

Blocks cookie notices on web pages.

- Filter ID: **18**
- Path: `<filters-directory>/declarative/ruleset_18/ruleset_18.json`

#### AdGuard Popups filter

Blocks all kinds of pop-ups that are not necessary for websites' operation according to our Filter policy.

- Filter ID: **19**
- Path: `<filters-directory>/declarative/ruleset_19/ruleset_19.json`

#### AdGuard Mobile App Banners filter

Blocks irritating banners that promote mobile apps of websites.

- Filter ID: **20**
- Path: `<filters-directory>/declarative/ruleset_20/ruleset_20.json`

#### AdGuard Other Annoyances filter

Blocks irritating elements on web pages that do not fall under the popular categories of annoyances.

- Filter ID: **21**
- Path: `<filters-directory>/declarative/ruleset_21/ruleset_21.json`

#### AdGuard Widgets filter

Blocks annoying third-party widgets: online assistants, live support chats, etc.

- Filter ID: **22**
- Path: `<filters-directory>/declarative/ruleset_22/ruleset_22.json`

### Security

#### Online Malicious URL Blocklist

Blocks domains that are known to be used to propagate malware and spyware.

- Filter ID: **208**
- Path: `<filters-directory>/declarative/ruleset_208/ruleset_208.json`

#### Phishing URL Blocklist

Phishing URL blocklist for uBlock Origin (uBO), AdGuard, Vivaldi, Pi-hole, Hosts file, Dnsmasq, BIND, Unbound, Snort and Suricata.

- Filter ID: **255**
- Path: `<filters-directory>/declarative/ruleset_255/ruleset_255.json`

#### Scam Blocklist by DurableNapkin

List for blocking untrustworthy websites.

- Filter ID: **256**
- Path: `<filters-directory>/declarative/ruleset_256/ruleset_256.json`

#### uBlock Origin – Badware risks

Filter for risky sites, warning users of potential threats.

- Filter ID: **257**
- Path: `<filters-directory>/declarative/ruleset_257/ruleset_257.json`

### Other

#### AdGuard Experimental filter

Filter designed to test certain hazardous filtering rules before they are added to the basic filters.

- Filter ID: **5**
- Path: `<filters-directory>/declarative/ruleset_5/ruleset_5.json`

#### Filter unblocking search ads and self-promotion

Filter that unblocks search ads in Google, DuckDuckGo, Bing, or Yahoo and self-promotion on websites.

- Filter ID: **10**
- Path: `<filters-directory>/declarative/ruleset_10/ruleset_10.json`

### Language-specific

#### AdGuard Russian filter

Filter that enables ad blocking on websites in Russian language.

- Filter ID: **1**
- Path: `<filters-directory>/declarative/ruleset_1/ruleset_1.json`

#### AdGuard German filter

EasyList Germany + AdGuard German filter. Filter list that specifically removes ads on websites in German language.

- Filter ID: **6**
- Path: `<filters-directory>/declarative/ruleset_6/ruleset_6.json`

#### AdGuard Japanese filter

Filter that enables ad blocking on websites in Japanese language.

- Filter ID: **7**
- Path: `<filters-directory>/declarative/ruleset_7/ruleset_7.json`

#### AdGuard Dutch filter

EasyList Dutch + AdGuard Dutch filter. Filter list that specifically removes ads on websites in Dutch language.

- Filter ID: **8**
- Path: `<filters-directory>/declarative/ruleset_8/ruleset_8.json`

#### AdGuard Spanish/Portuguese filter

Filter list that specifically removes ads on websites in Spanish, Portuguese, and Brazilian Portuguese languages.

- Filter ID: **9**
- Path: `<filters-directory>/declarative/ruleset_9/ruleset_9.json`

#### AdGuard Turkish filter

Filter list that specifically removes ads on websites in Turkish language.

- Filter ID: **13**
- Path: `<filters-directory>/declarative/ruleset_13/ruleset_13.json`

#### AdGuard French filter

Liste FR + AdGuard French filter. Filter list that specifically removes ads on websites in French language.

- Filter ID: **16**
- Path: `<filters-directory>/declarative/ruleset_16/ruleset_16.json`

#### AdGuard Ukrainian filter

Filter that enables ad blocking on websites in Ukrainian language.

- Filter ID: **23**
- Path: `<filters-directory>/declarative/ruleset_23/ruleset_23.json`

#### Bulgarian list

Additional filter list for websites in Bulgarian.

- Filter ID: **103**
- Path: `<filters-directory>/declarative/ruleset_103/ruleset_103.json`

#### EasyList Czech and Slovak

Additional filter list for websites in Czech and Slovak.

- Filter ID: **105**
- Path: `<filters-directory>/declarative/ruleset_105/ruleset_105.json`

#### EasyList Hebrew

Additional filter list for websites in Hebrew.

- Filter ID: **108**
- Path: `<filters-directory>/declarative/ruleset_108/ruleset_108.json`

#### EasyList Italy

Additional filter list for websites in Italian.

- Filter ID: **109**
- Path: `<filters-directory>/declarative/ruleset_109/ruleset_109.json`

#### EasyList Lithuania

Additional filter list for websites in Lithuanian.

- Filter ID: **110**
- Path: `<filters-directory>/declarative/ruleset_110/ruleset_110.json`

#### Latvian List

Additional filter list for websites in Latvian.

- Filter ID: **111**
- Path: `<filters-directory>/declarative/ruleset_111/ruleset_111.json`

#### Liste AR

Additional filter list for websites in Arabic.

- Filter ID: **112**
- Path: `<filters-directory>/declarative/ruleset_112/ruleset_112.json`

#### AdBlockID

Additional filter list for websites in Indonesian.

- Filter ID: **120**
- Path: `<filters-directory>/declarative/ruleset_120/ruleset_120.json`

#### EasyList Thailand

Filter that blocks ads on Thai sites.

- Filter ID: **202**
- Path: `<filters-directory>/declarative/ruleset_202/ruleset_202.json`

#### Hungarian filter

Hufilter. Filter list that specifically removes ads on websites in the Hungarian language.

- Filter ID: **203**
- Path: `<filters-directory>/declarative/ruleset_203/ruleset_203.json`

#### ABPVN List

Vietnamese adblock filter list.

- Filter ID: **214**
- Path: `<filters-directory>/declarative/ruleset_214/ruleset_214.json`

#### Official Polish filters for AdBlock, uBlock Origin & AdGuard

Additional filter list for websites in Polish.

- Filter ID: **216**
- Path: `<filters-directory>/declarative/ruleset_216/ruleset_216.json`

#### Polish GDPR-Cookies Filters

Polish filter list for cookies blocking.

- Filter ID: **217**
- Path: `<filters-directory>/declarative/ruleset_217/ruleset_217.json`

#### Estonian List

Filter for ad blocking on Estonian sites.

- Filter ID: **218**
- Path: `<filters-directory>/declarative/ruleset_218/ruleset_218.json`

#### AdGuard Chinese filter

EasyList China + AdGuard Chinese filter. Filter list that specifically removes ads on websites in Chinese language.

- Filter ID: **224**
- Path: `<filters-directory>/declarative/ruleset_224/ruleset_224.json`

#### List-KR

Filter that removes ads and various scripts from websites with Korean content. Combined and augmented with AdGuard-specific rules for enhanced filtering. This filter is expected to be used alongside with AdGuard Base filter.

- Filter ID: **227**
- Path: `<filters-directory>/declarative/ruleset_227/ruleset_227.json`

#### Adblock List for Finland

Finnish ad blocking filter list.

- Filter ID: **233**
- Path: `<filters-directory>/declarative/ruleset_233/ruleset_233.json`

#### Persian Blocker

Filter list for blocking ads and trackers on websites in Persian.

- Filter ID: **235**
- Path: `<filters-directory>/declarative/ruleset_235/ruleset_235.json`

#### Polish Anti Adblock Filters

Official Polish filters against Adblock alerts.

- Filter ID: **238**
- Path: `<filters-directory>/declarative/ruleset_238/ruleset_238.json`

#### Frellwit's Swedish Filter

Filter that aims to remove regional Swedish ads, tracking, social media, annoyances, sponsored articles etc.

- Filter ID: **243**
- Path: `<filters-directory>/declarative/ruleset_243/ruleset_243.json`

#### Dandelion Sprout's Nordic Filters

This list covers websites for Norway, Denmark, Iceland, Danish territories, and the Sami indigenous population.

- Filter ID: **249**
- Path: `<filters-directory>/declarative/ruleset_249/ruleset_249.json`

#### Dandelion Sprout's Serbo-Croatian List

A filter list for websites in Serbian, Montenegrin, Croatian, and Bosnian.

- Filter ID: **252**
- Path: `<filters-directory>/declarative/ruleset_252/ruleset_252.json`

#### IndianList

Additional filter list for websites in Hindi, Tamil and other Dravidian and Indic languages.

- Filter ID: **253**
- Path: `<filters-directory>/declarative/ruleset_253/ruleset_253.json`

#### Macedonian adBlock Filters

Blocks ads and trackers on various Macedonian websites.

- Filter ID: **254**
- Path: `<filters-directory>/declarative/ruleset_254/ruleset_254.json`

## Development

### `build:assets`

Downloads original rules, converts it to DNR rule sets via [TSUrlFilter declarative-converter](../tsurlfilter/README.md#declarativeconverter) and generates extension manifest with predefined rules resources.

```bash
pnpm run build:assets
```

### `build:lib`

Builds SDK to load DNR rule sets to the specified directory.

```bash
pnpm run build:lib
```

### `build:cli`

Builds CLI utility to load DNR rule sets to the specified directory.

```bash
pnpm run build:cli
```

### `build:docs`

Generates [Included filter lists](#included-filter-lists) section.

```bash
pnpm run build:docs
```

### `build`

Clears `dist` folder and runs `build:assets`, `build:cli` and `build:lib` scripts.

```bash
pnpm run build
```
