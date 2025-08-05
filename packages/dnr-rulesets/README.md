# Dnr-rulesets

Utility to load prebuilt AdGuard DNR rulesets for mv3 extensions.

The list of available filters can be found by `filters` in the metadata of:
- [Chromium MV3 filters](https://filters.adtidy.org/extension/chromium-mv3/filters.json),
- [Opera filters](https://filters.adtidy.org/extension/opera/filters.json).

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
         - [Chromium MV3 filters](#chromium-mv3-filters)
            - [Ad blocking](#ad-blocking)
                - [AdGuard Base filter](#adguard-base-filter)
                - [AdGuard Mobile Ads filter](#adguard-mobile-ads-filter)
                - [AdGuard Quick Fixes filter](#adguard-quick-fixes-filter)
            - [Privacy](#privacy)
                - [AdGuard Tracking Protection filter](#adguard-tracking-protection-filter)
                - [AdGuard URL Tracking filter](#adguard-url-tracking-filter)
            - [Social widgets](#social-widgets)
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
                - [uBlock Origin – Badware risks](#ublock-origin-badware-risks)
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
                - [Official Polish filters for AdBlock, uBlock Origin & AdGuard](#official-polish-filters-for-adblock-ublock-origin-adguard)
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
        - [Opera filters](#opera-filters)
            - [Ad blocking](#ad-blocking)
                - [AdGuard Base filter](#adguard-base-filter)
                - [AdGuard Mobile Ads filter](#adguard-mobile-ads-filter)
                - [EasyList](#easylist)
            - [Privacy](#privacy)
                - [AdGuard Tracking Protection filter](#adguard-tracking-protection-filter)
                - [AdGuard URL Tracking filter](#adguard-url-tracking-filter)
                - [EasyPrivacy](#easyprivacy)
                - [Peter Lowe's Blocklist](#peter-lowes-blocklist)
                - [Fanboy's Anti-Facebook List](#fanboys-anti-facebook-list)
                - [Legitimate URL Shortener](#legitimate-url-shortener)
                - [uBlock Origin – Block Outsider Intrusion into LAN](#ublock-origin-block-outsider-intrusion-into-lan)
            - [Social widgets](#social-widgets)
                - [AdGuard Social Media filter](#adguard-social-media-filter)
                - [Fanboy's Social Blocking List](#fanboys-social-blocking-list)
            - [Annoyances](#annoyances)
                - [AdGuard Annoyances filter](#adguard-annoyances-filter)
                - [AdGuard Cookie Notices filter](#adguard-cookie-notices-filter)
                - [AdGuard Popups filter](#adguard-popups-filter)
                - [AdGuard Mobile App Banners filter](#adguard-mobile-app-banners-filter)
                - [AdGuard Other Annoyances filter](#adguard-other-annoyances-filter)
                - [AdGuard Widgets filter](#adguard-widgets-filter)
                - [Fanboy's Annoyances](#fanboys-annoyances)
                - [Adblock Warning Removal List](#adblock-warning-removal-list)
                - [EasyList Cookie List](#easylist-cookie-list)
                - [Dandelion Sprout's Annoyances List](#dandelion-sprouts-annoyances-list)
            - [Security](#security)
                - [Online Malicious URL Blocklist](#online-malicious-url-blocklist)
                - [Phishing URL Blocklist](#phishing-url-blocklist)
                - [Scam Blocklist by DurableNapkin](#scam-blocklist-by-durablenapkin)
                - [uBlock Origin – Badware risks](#ublock-origin-badware-risks)
            - [Other](#other)
                - [AdGuard Experimental filter](#adguard-experimental-filter)
                - [Filter unblocking search ads and self-promotion](#filter-unblocking-search-ads-and-self-promotion)
                - [AdGuard DNS filter](#adguard-dns-filter)
                - [Fanboy's Anti-thirdparty Fonts](#fanboys-anti-thirdparty-fonts)
            - [Language-specific](#language-specific)
                - [AdGuard Russian filter](#adguard-russian-filter)
                - [AdGuard German filter](#adguard-german-filter)
                - [AdGuard Japanese filter](#adguard-japanese-filter)
                - [AdGuard Dutch filter](#adguard-dutch-filter)
                - [AdGuard Spanish/Portuguese filter](#adguard-spanishportuguese-filter)
                - [AdGuard Turkish filter](#adguard-turkish-filter)
                - [AdGuard French filter](#adguard-french-filter)
                - [AdGuard Ukrainian filter](#adguard-ukrainian-filter)
                - [ABPindo](#abpindo)
                - [Bulgarian list](#bulgarian-list)
                - [EasyList China](#easylist-china)
                - [EasyList Czech and Slovak](#easylist-czech-and-slovak)
                - [EasyList Dutch](#easylist-dutch)
                - [EasyList Germany](#easylist-germany)
                - [EasyList Hebrew](#easylist-hebrew)
                - [EasyList Italy](#easylist-italy)
                - [EasyList Lithuania](#easylist-lithuania)
                - [Latvian List](#latvian-list)
                - [Liste AR](#liste-ar)
                - [Liste FR](#liste-fr)
                - [ROList](#rolist)
                - [Icelandic ABP List](#icelandic-abp-list)
                - [AdBlockID](#adblockid)
                - [Greek AdBlock Filter](#greek-adblock-filter)
                - [EasyList Portuguese](#easylist-portuguese)
                - [EasyList Thailand](#easylist-thailand)
                - [Hungarian filter](#hungarian-filter)
                - [Xfiles](#xfiles)
                - [RU AdList: Counters](#ru-adlist-counters)
                - [ABPVN List](#abpvn-list)
                - [Official Polish filters for AdBlock, uBlock Origin & AdGuard](#official-polish-filters-for-adblock-ublock-origin-adguard)
                - [Polish GDPR-Cookies Filters](#polish-gdpr-cookies-filters)
                - [Estonian List](#estonian-list)
                - [CJX's Annoyances List](#cjxs-annoyances-list)
                - [Polish Social Filters](#polish-social-filters)
                - [AdGuard Chinese filter](#adguard-chinese-filter)
                - [List-KR](#list-kr)
                - [xinggsf](#xinggsf)
                - [EasyList Spanish](#easylist-spanish)
                - [KAD - Anti-Scam](#kad---anti-scam)
                - [Adblock List for Finland](#adblock-list-for-finland)
                - [ROLIST2](#rolist2)
                - [Persian Blocker](#persian-blocker)
                - [road-block light](#road-block-light)
                - [Polish Annoyances Filters](#polish-annoyances-filters)
                - [Polish Anti Adblock Filters](#polish-anti-adblock-filters)
                - [Frellwit's Swedish Filter](#frellwits-swedish-filter)
                - [YousList](#youslist)
                - [EasyList Polish](#easylist-polish)
                - [Polish Anti-Annoying Special Supplement](#polish-anti-annoying-special-supplement)
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
- `-b, --browser <browser>` - specify browser to load filters for (default: "chromium-mv3"). Available browsers: `chromium-mv3`, `opera`.

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
- `-b, --browser <browser>` - specify browser to download latest filters for (default: "chromium-mv3"). See `--latest-filters` option. Available browsers: `chromium-mv3`, `opera`.
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

2. Patch extension manifest.

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

Where `<browser>` is the browser for which the rulesets are built, e.g. `chromium-mv3` or `opera`.

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

### Chromium MV3 filters

These filter lists are used in Chromium MV3 browsers.

#### Ad blocking

##### AdGuard Base filter

EasyList + AdGuard English filter. This filter is necessary for quality ad blocking.

- Filter ID: **2**
- Path: `dist/filters/chromium-mv3/declarative/ruleset_2/ruleset_2.json`

##### AdGuard Mobile Ads filter

Filter for all known mobile ad networks. Useful for mobile devices.

- Filter ID: **11**
- Path: `dist/filters/chromium-mv3/declarative/ruleset_11/ruleset_11.json`

##### AdGuard Quick Fixes filter

**IMPORTANT:** This filter is not convertible (excluded from build), but it is still included in the metadata. It should be downloaded from the server on the client and applied dynamically.

Filter to quickly resolve content filtering issues on popular websites without updating the extension.

- Filter ID: **24**

#### Privacy

##### AdGuard Tracking Protection filter

The most comprehensive list of various online counters and web analytics tools. Use this filter if you do not want your actions on the Internet to be tracked.

- Filter ID: **3**
- Path: `dist/filters/chromium-mv3/declarative/ruleset_3/ruleset_3.json`

##### AdGuard URL Tracking filter

Filter that enhances privacy by removing tracking parameters from URLs.

- Filter ID: **17**
- Path: `dist/filters/chromium-mv3/declarative/ruleset_17/ruleset_17.json`

#### Social widgets

##### AdGuard Social Media filter

Filter for social media widgets such as 'Like' and 'Share' buttons and more.

- Filter ID: **4**
- Path: `dist/filters/chromium-mv3/declarative/ruleset_4/ruleset_4.json`

#### Annoyances

##### AdGuard Cookie Notices filter

Blocks cookie notices on web pages.

- Filter ID: **18**
- Path: `dist/filters/chromium-mv3/declarative/ruleset_18/ruleset_18.json`

##### AdGuard Popups filter

Blocks all kinds of pop-ups that are not necessary for websites' operation according to our Filter policy.

- Filter ID: **19**
- Path: `dist/filters/chromium-mv3/declarative/ruleset_19/ruleset_19.json`

##### AdGuard Mobile App Banners filter

Blocks irritating banners that promote mobile apps of websites.

- Filter ID: **20**
- Path: `dist/filters/chromium-mv3/declarative/ruleset_20/ruleset_20.json`

##### AdGuard Other Annoyances filter

Blocks irritating elements on web pages that do not fall under the popular categories of annoyances.

- Filter ID: **21**
- Path: `dist/filters/chromium-mv3/declarative/ruleset_21/ruleset_21.json`

##### AdGuard Widgets filter

Blocks annoying third-party widgets: online assistants, live support chats, etc.

- Filter ID: **22**
- Path: `dist/filters/chromium-mv3/declarative/ruleset_22/ruleset_22.json`

#### Security

##### Online Malicious URL Blocklist

Blocks domains that are known to be used to propagate malware and spyware.

- Filter ID: **208**
- Path: `dist/filters/chromium-mv3/declarative/ruleset_208/ruleset_208.json`

##### Phishing URL Blocklist

Phishing URL blocklist for uBlock Origin (uBO), AdGuard, Vivaldi, Pi-hole, Hosts file, Dnsmasq, BIND, Unbound, Snort and Suricata.

- Filter ID: **255**
- Path: `dist/filters/chromium-mv3/declarative/ruleset_255/ruleset_255.json`

##### Scam Blocklist by DurableNapkin

List for blocking untrustworthy websites.

- Filter ID: **256**
- Path: `dist/filters/chromium-mv3/declarative/ruleset_256/ruleset_256.json`

##### uBlock Origin – Badware risks

Filter for risky sites, warning users of potential threats.

- Filter ID: **257**
- Path: `dist/filters/chromium-mv3/declarative/ruleset_257/ruleset_257.json`

#### Other

##### AdGuard Experimental filter

Filter designed to test certain hazardous filtering rules before they are added to the basic filters.

- Filter ID: **5**
- Path: `dist/filters/chromium-mv3/declarative/ruleset_5/ruleset_5.json`

##### Filter unblocking search ads and self-promotion

Filter that unblocks search ads in Google, DuckDuckGo, Bing, or Yahoo and self-promotion on websites.

- Filter ID: **10**
- Path: `dist/filters/chromium-mv3/declarative/ruleset_10/ruleset_10.json`

#### Language-specific

##### AdGuard Russian filter

Filter that enables ad blocking on websites in Russian language.

- Filter ID: **1**
- Path: `dist/filters/chromium-mv3/declarative/ruleset_1/ruleset_1.json`

##### AdGuard German filter

EasyList Germany + AdGuard German filter. Filter list that specifically removes ads on websites in German language.

- Filter ID: **6**
- Path: `dist/filters/chromium-mv3/declarative/ruleset_6/ruleset_6.json`

##### AdGuard Japanese filter

Filter that enables ad blocking on websites in Japanese language.

- Filter ID: **7**
- Path: `dist/filters/chromium-mv3/declarative/ruleset_7/ruleset_7.json`

##### AdGuard Dutch filter

EasyList Dutch + AdGuard Dutch filter. Filter list that specifically removes ads on websites in Dutch language.

- Filter ID: **8**
- Path: `dist/filters/chromium-mv3/declarative/ruleset_8/ruleset_8.json`

##### AdGuard Spanish/Portuguese filter

Filter list that specifically removes ads on websites in Spanish, Portuguese, and Brazilian Portuguese languages.

- Filter ID: **9**
- Path: `dist/filters/chromium-mv3/declarative/ruleset_9/ruleset_9.json`

##### AdGuard Turkish filter

Filter list that specifically removes ads on websites in Turkish language.

- Filter ID: **13**
- Path: `dist/filters/chromium-mv3/declarative/ruleset_13/ruleset_13.json`

##### AdGuard French filter

Liste FR + AdGuard French filter. Filter list that specifically removes ads on websites in French language.

- Filter ID: **16**
- Path: `dist/filters/chromium-mv3/declarative/ruleset_16/ruleset_16.json`

##### AdGuard Ukrainian filter

Filter that enables ad blocking on websites in Ukrainian language.

- Filter ID: **23**
- Path: `dist/filters/chromium-mv3/declarative/ruleset_23/ruleset_23.json`

##### Bulgarian list

Additional filter list for websites in Bulgarian.

- Filter ID: **103**
- Path: `dist/filters/chromium-mv3/declarative/ruleset_103/ruleset_103.json`

##### EasyList Czech and Slovak

Additional filter list for websites in Czech and Slovak.

- Filter ID: **105**
- Path: `dist/filters/chromium-mv3/declarative/ruleset_105/ruleset_105.json`

##### EasyList Hebrew

Additional filter list for websites in Hebrew.

- Filter ID: **108**
- Path: `dist/filters/chromium-mv3/declarative/ruleset_108/ruleset_108.json`

##### EasyList Italy

Additional filter list for websites in Italian.

- Filter ID: **109**
- Path: `dist/filters/chromium-mv3/declarative/ruleset_109/ruleset_109.json`

##### EasyList Lithuania

Additional filter list for websites in Lithuanian.

- Filter ID: **110**
- Path: `dist/filters/chromium-mv3/declarative/ruleset_110/ruleset_110.json`

##### Latvian List

Additional filter list for websites in Latvian.

- Filter ID: **111**
- Path: `dist/filters/chromium-mv3/declarative/ruleset_111/ruleset_111.json`

##### Liste AR

Additional filter list for websites in Arabic.

- Filter ID: **112**
- Path: `dist/filters/chromium-mv3/declarative/ruleset_112/ruleset_112.json`

##### AdBlockID

Additional filter list for websites in Indonesian.

- Filter ID: **120**
- Path: `dist/filters/chromium-mv3/declarative/ruleset_120/ruleset_120.json`

##### EasyList Thailand

Filter that blocks ads on Thai sites.

- Filter ID: **202**
- Path: `dist/filters/chromium-mv3/declarative/ruleset_202/ruleset_202.json`

##### Hungarian filter

Hufilter. Filter list that specifically removes ads on websites in the Hungarian language.

- Filter ID: **203**
- Path: `dist/filters/chromium-mv3/declarative/ruleset_203/ruleset_203.json`

##### ABPVN List

Vietnamese adblock filter list.

- Filter ID: **214**
- Path: `dist/filters/chromium-mv3/declarative/ruleset_214/ruleset_214.json`

##### Official Polish filters for AdBlock, uBlock Origin & AdGuard

Additional filter list for websites in Polish.

- Filter ID: **216**
- Path: `dist/filters/chromium-mv3/declarative/ruleset_216/ruleset_216.json`

##### Polish GDPR-Cookies Filters

Polish filter list for cookies blocking.

- Filter ID: **217**
- Path: `dist/filters/chromium-mv3/declarative/ruleset_217/ruleset_217.json`

##### Estonian List

Filter for ad blocking on Estonian sites.

- Filter ID: **218**
- Path: `dist/filters/chromium-mv3/declarative/ruleset_218/ruleset_218.json`

##### AdGuard Chinese filter

EasyList China + AdGuard Chinese filter. Filter list that specifically removes ads on websites in Chinese language.

- Filter ID: **224**
- Path: `dist/filters/chromium-mv3/declarative/ruleset_224/ruleset_224.json`

##### List-KR

Filter that removes ads and various scripts from websites with Korean content. Combined and augmented with AdGuard-specific rules for enhanced filtering. This filter is expected to be used alongside with AdGuard Base filter.

- Filter ID: **227**
- Path: `dist/filters/chromium-mv3/declarative/ruleset_227/ruleset_227.json`

##### Adblock List for Finland

Finnish ad blocking filter list.

- Filter ID: **233**
- Path: `dist/filters/chromium-mv3/declarative/ruleset_233/ruleset_233.json`

##### Persian Blocker

Filter list for blocking ads and trackers on websites in Persian.

- Filter ID: **235**
- Path: `dist/filters/chromium-mv3/declarative/ruleset_235/ruleset_235.json`

##### Polish Anti Adblock Filters

Official Polish filters against Adblock alerts.

- Filter ID: **238**
- Path: `dist/filters/chromium-mv3/declarative/ruleset_238/ruleset_238.json`

##### Frellwit's Swedish Filter

Filter that aims to remove regional Swedish ads, tracking, social media, annoyances, sponsored articles etc.

- Filter ID: **243**
- Path: `dist/filters/chromium-mv3/declarative/ruleset_243/ruleset_243.json`

##### Dandelion Sprout's Nordic Filters

This list covers websites for Norway, Denmark, Iceland, Danish territories, and the Sami indigenous population.

- Filter ID: **249**
- Path: `dist/filters/chromium-mv3/declarative/ruleset_249/ruleset_249.json`

##### Dandelion Sprout's Serbo-Croatian List

A filter list for websites in Serbian, Montenegrin, Croatian, and Bosnian.

- Filter ID: **252**
- Path: `dist/filters/chromium-mv3/declarative/ruleset_252/ruleset_252.json`

##### IndianList

Additional filter list for websites in Hindi, Tamil and other Dravidian and Indic languages.

- Filter ID: **253**
- Path: `dist/filters/chromium-mv3/declarative/ruleset_253/ruleset_253.json`

##### Macedonian adBlock Filters

Blocks ads and trackers on various Macedonian websites.

- Filter ID: **254**
- Path: `dist/filters/chromium-mv3/declarative/ruleset_254/ruleset_254.json`

### Opera filters

These filter lists are used in Opera browser.

#### Ad blocking

##### AdGuard Base filter

EasyList + AdGuard English filter. This filter is necessary for quality ad blocking.

- Filter ID: **2**
- Path: `dist/filters/opera/declarative/ruleset_2/ruleset_2.json`

##### AdGuard Mobile Ads filter

Filter for all known mobile ad networks. Useful for mobile devices.

- Filter ID: **11**
- Path: `dist/filters/opera/declarative/ruleset_11/ruleset_11.json`

##### EasyList

EasyList is the primary subscription that removes adverts from web pages in English. Already included in AdGuard Base filter.

- Filter ID: **101**
- Path: `dist/filters/opera/declarative/ruleset_101/ruleset_101.json`

#### Privacy

##### AdGuard Tracking Protection filter

The most comprehensive list of various online counters and web analytics tools. Use this filter if you do not want your actions on the Internet to be tracked.

- Filter ID: **3**
- Path: `dist/filters/opera/declarative/ruleset_3/ruleset_3.json`

##### AdGuard URL Tracking filter

Filter that enhances privacy by removing tracking parameters from URLs.

- Filter ID: **17**
- Path: `dist/filters/opera/declarative/ruleset_17/ruleset_17.json`

##### EasyPrivacy

Privacy protection supplement for EasyList.

- Filter ID: **118**
- Path: `dist/filters/opera/declarative/ruleset_118/ruleset_118.json`

##### Peter Lowe's Blocklist

Filter that blocks ads, trackers, and other nasty things.

- Filter ID: **204**
- Path: `dist/filters/opera/declarative/ruleset_204/ruleset_204.json`

##### Fanboy's Anti-Facebook List

Warning, it will break Facebook-based comments on some websites and may also break some Facebook apps or games.

- Filter ID: **225**
- Path: `dist/filters/opera/declarative/ruleset_225/ruleset_225.json`

##### Legitimate URL Shortener

Automatically removes unnecessary '$' and '&' values from URLs, making them easier to copy from the URL bar and pasting elsewhere as links. Already included in Dandelion Sprout's Annoyances List.

- Filter ID: **251**
- Path: `dist/filters/opera/declarative/ruleset_251/ruleset_251.json`

##### uBlock Origin – Block Outsider Intrusion into LAN

Prevents public Internet sites from digging into your LAN files.

- Filter ID: **258**
- Path: `dist/filters/opera/declarative/ruleset_258/ruleset_258.json`

#### Social widgets

##### AdGuard Social Media filter

Filter for social media widgets such as 'Like' and 'Share' buttons and more.

- Filter ID: **4**
- Path: `dist/filters/opera/declarative/ruleset_4/ruleset_4.json`

##### Fanboy's Social Blocking List

Hides and blocks social content, social widgets, social scripts and social icons. Already included in Fanboy's Annoyances list.

- Filter ID: **123**
- Path: `dist/filters/opera/declarative/ruleset_123/ruleset_123.json`

#### Annoyances

##### AdGuard Annoyances filter

Blocks irritating elements on web pages including cookie notices, third-party widgets and in-page pop-ups. Contains the following AdGuard filters: Cookie Notices, Popups, Mobile App Banners, Other Annoyances and Widgets.

- Filter ID: **14**
- Path: `dist/filters/opera/declarative/ruleset_14/ruleset_14.json`

##### AdGuard Cookie Notices filter

Blocks cookie notices on web pages.

- Filter ID: **18**
- Path: `dist/filters/opera/declarative/ruleset_18/ruleset_18.json`

##### AdGuard Popups filter

Blocks all kinds of pop-ups that are not necessary for websites' operation according to our Filter policy.

- Filter ID: **19**
- Path: `dist/filters/opera/declarative/ruleset_19/ruleset_19.json`

##### AdGuard Mobile App Banners filter

Blocks irritating banners that promote mobile apps of websites.

- Filter ID: **20**
- Path: `dist/filters/opera/declarative/ruleset_20/ruleset_20.json`

##### AdGuard Other Annoyances filter

Blocks irritating elements on web pages that do not fall under the popular categories of annoyances.

- Filter ID: **21**
- Path: `dist/filters/opera/declarative/ruleset_21/ruleset_21.json`

##### AdGuard Widgets filter

Blocks annoying third-party widgets: online assistants, live support chats, etc.

- Filter ID: **22**
- Path: `dist/filters/opera/declarative/ruleset_22/ruleset_22.json`

##### Fanboy's Annoyances

Removes in-page pop-ups and other annoyances. Includes Fanboy's Social Blocking & EasyList Cookie Lists.

- Filter ID: **122**
- Path: `dist/filters/opera/declarative/ruleset_122/ruleset_122.json`

##### Adblock Warning Removal List

Removes anti-adblock warnings and other obtrusive messages.

- Filter ID: **207**
- Path: `dist/filters/opera/declarative/ruleset_207/ruleset_207.json`

##### EasyList Cookie List

Removes cookie and privacy warnings. Already included in Fanboy's Annoyances list.

- Filter ID: **241**
- Path: `dist/filters/opera/declarative/ruleset_241/ruleset_241.json`

##### Dandelion Sprout's Annoyances List

This list is made in the style of AdGuard's and Fanboy's annoyances lists. It combines many of Dandelion Sprout's proudest and most frequently maintained international lists, as a curated compilation for simplicity's sake.

- Filter ID: **250**
- Path: `dist/filters/opera/declarative/ruleset_250/ruleset_250.json`

#### Security

##### Online Malicious URL Blocklist

Blocks domains that are known to be used to propagate malware and spyware.

- Filter ID: **208**
- Path: `dist/filters/opera/declarative/ruleset_208/ruleset_208.json`

##### Phishing URL Blocklist

Phishing URL blocklist for uBlock Origin (uBO), AdGuard, Vivaldi, Pi-hole, Hosts file, Dnsmasq, BIND, Unbound, Snort and Suricata.

- Filter ID: **255**
- Path: `dist/filters/opera/declarative/ruleset_255/ruleset_255.json`

##### Scam Blocklist by DurableNapkin

List for blocking untrustworthy websites.

- Filter ID: **256**
- Path: `dist/filters/opera/declarative/ruleset_256/ruleset_256.json`

##### uBlock Origin – Badware risks

Filter for risky sites, warning users of potential threats.

- Filter ID: **257**
- Path: `dist/filters/opera/declarative/ruleset_257/ruleset_257.json`

#### Other

##### AdGuard Experimental filter

Filter designed to test certain hazardous filtering rules before they are added to the basic filters.

- Filter ID: **5**
- Path: `dist/filters/opera/declarative/ruleset_5/ruleset_5.json`

##### Filter unblocking search ads and self-promotion

Filter that unblocks search ads in Google, DuckDuckGo, Bing, or Yahoo and self-promotion on websites.

- Filter ID: **10**
- Path: `dist/filters/opera/declarative/ruleset_10/ruleset_10.json`

##### AdGuard DNS filter

Filter composed of several other filters (AdGuard Base filter, Social Media filter, Tracking Protection filter, Mobile Ads filter, EasyList and EasyPrivacy) and simplified specifically to be better compatible with DNS-level ad blocking.

- Filter ID: **15**
- Path: `dist/filters/opera/declarative/ruleset_15/ruleset_15.json`

##### Fanboy's Anti-thirdparty Fonts

A filter that blocks third-party fonts. It may break the look and design of some websites.

- Filter ID: **239**
- Path: `dist/filters/opera/declarative/ruleset_239/ruleset_239.json`

#### Language-specific

##### AdGuard Russian filter

Filter that enables ad blocking on websites in Russian language.

- Filter ID: **1**
- Path: `dist/filters/opera/declarative/ruleset_1/ruleset_1.json`

##### AdGuard German filter

EasyList Germany + AdGuard German filter. Filter list that specifically removes ads on websites in German language.

- Filter ID: **6**
- Path: `dist/filters/opera/declarative/ruleset_6/ruleset_6.json`

##### AdGuard Japanese filter

Filter that enables ad blocking on websites in Japanese language.

- Filter ID: **7**
- Path: `dist/filters/opera/declarative/ruleset_7/ruleset_7.json`

##### AdGuard Dutch filter

EasyList Dutch + AdGuard Dutch filter. Filter list that specifically removes ads on websites in Dutch language.

- Filter ID: **8**
- Path: `dist/filters/opera/declarative/ruleset_8/ruleset_8.json`

##### AdGuard Spanish/Portuguese filter

Filter list that specifically removes ads on websites in Spanish, Portuguese, and Brazilian Portuguese languages.

- Filter ID: **9**
- Path: `dist/filters/opera/declarative/ruleset_9/ruleset_9.json`

##### AdGuard Turkish filter

Filter list that specifically removes ads on websites in Turkish language.

- Filter ID: **13**
- Path: `dist/filters/opera/declarative/ruleset_13/ruleset_13.json`

##### AdGuard French filter

Liste FR + AdGuard French filter. Filter list that specifically removes ads on websites in French language.

- Filter ID: **16**
- Path: `dist/filters/opera/declarative/ruleset_16/ruleset_16.json`

##### AdGuard Ukrainian filter

Filter that enables ad blocking on websites in Ukrainian language.

- Filter ID: **23**
- Path: `dist/filters/opera/declarative/ruleset_23/ruleset_23.json`

##### ABPindo

Additional filter list for websites in Indonesian.

- Filter ID: **102**
- Path: `dist/filters/opera/declarative/ruleset_102/ruleset_102.json`

##### Bulgarian list

Additional filter list for websites in Bulgarian.

- Filter ID: **103**
- Path: `dist/filters/opera/declarative/ruleset_103/ruleset_103.json`

##### EasyList China

Additional filter list for websites in Chinese. Already included in AdGuard Chinese filter.

- Filter ID: **104**
- Path: `dist/filters/opera/declarative/ruleset_104/ruleset_104.json`

##### EasyList Czech and Slovak

Additional filter list for websites in Czech and Slovak.

- Filter ID: **105**
- Path: `dist/filters/opera/declarative/ruleset_105/ruleset_105.json`

##### EasyList Dutch

Additional filter list for websites in Dutch. Already included in AdGuard Dutch filter.

- Filter ID: **106**
- Path: `dist/filters/opera/declarative/ruleset_106/ruleset_106.json`

##### EasyList Germany

Additional filter list for websites in German. Already included in AdGuard German filter.

- Filter ID: **107**
- Path: `dist/filters/opera/declarative/ruleset_107/ruleset_107.json`

##### EasyList Hebrew

Additional filter list for websites in Hebrew.

- Filter ID: **108**
- Path: `dist/filters/opera/declarative/ruleset_108/ruleset_108.json`

##### EasyList Italy

Additional filter list for websites in Italian.

- Filter ID: **109**
- Path: `dist/filters/opera/declarative/ruleset_109/ruleset_109.json`

##### EasyList Lithuania

Additional filter list for websites in Lithuanian.

- Filter ID: **110**
- Path: `dist/filters/opera/declarative/ruleset_110/ruleset_110.json`

##### Latvian List

Additional filter list for websites in Latvian.

- Filter ID: **111**
- Path: `dist/filters/opera/declarative/ruleset_111/ruleset_111.json`

##### Liste AR

Additional filter list for websites in Arabic.

- Filter ID: **112**
- Path: `dist/filters/opera/declarative/ruleset_112/ruleset_112.json`

##### Liste FR

Additional filter list for websites in French. Already included in AdGuard French filter.

- Filter ID: **113**
- Path: `dist/filters/opera/declarative/ruleset_113/ruleset_113.json`

##### ROList

Additional filter list for websites in Romanian.

- Filter ID: **114**
- Path: `dist/filters/opera/declarative/ruleset_114/ruleset_114.json`

##### Icelandic ABP List

Additional filter list for websites in Icelandic.

- Filter ID: **119**
- Path: `dist/filters/opera/declarative/ruleset_119/ruleset_119.json`

##### AdBlockID

Additional filter list for websites in Indonesian.

- Filter ID: **120**
- Path: `dist/filters/opera/declarative/ruleset_120/ruleset_120.json`

##### Greek AdBlock Filter

Additional filter list for websites in Greek.

- Filter ID: **121**
- Path: `dist/filters/opera/declarative/ruleset_121/ruleset_121.json`

##### EasyList Portuguese

Additional filter list for websites in Spanish and Portuguese.

- Filter ID: **124**
- Path: `dist/filters/opera/declarative/ruleset_124/ruleset_124.json`

##### EasyList Thailand

Filter that blocks ads on Thai sites.

- Filter ID: **202**
- Path: `dist/filters/opera/declarative/ruleset_202/ruleset_202.json`

##### Hungarian filter

Hufilter. Filter list that specifically removes ads on websites in the Hungarian language.

- Filter ID: **203**
- Path: `dist/filters/opera/declarative/ruleset_203/ruleset_203.json`

##### Xfiles

Italian adblock filter list.

- Filter ID: **206**
- Path: `dist/filters/opera/declarative/ruleset_206/ruleset_206.json`

##### RU AdList: Counters

RU AdList supplement for trackers blocking.

- Filter ID: **212**
- Path: `dist/filters/opera/declarative/ruleset_212/ruleset_212.json`

##### ABPVN List

Vietnamese adblock filter list.

- Filter ID: **214**
- Path: `dist/filters/opera/declarative/ruleset_214/ruleset_214.json`

##### Official Polish filters for AdBlock, uBlock Origin & AdGuard

Additional filter list for websites in Polish.

- Filter ID: **216**
- Path: `dist/filters/opera/declarative/ruleset_216/ruleset_216.json`

##### Polish GDPR-Cookies Filters

Polish filter list for cookies blocking.

- Filter ID: **217**
- Path: `dist/filters/opera/declarative/ruleset_217/ruleset_217.json`

##### Estonian List

Filter for ad blocking on Estonian sites.

- Filter ID: **218**
- Path: `dist/filters/opera/declarative/ruleset_218/ruleset_218.json`

##### CJX's Annoyances List

Supplement for EasyList China+EasyList and EasyPrivacy.

- Filter ID: **220**
- Path: `dist/filters/opera/declarative/ruleset_220/ruleset_220.json`

##### Polish Social Filters

Polish filter list for social widgets, popups, etc.

- Filter ID: **221**
- Path: `dist/filters/opera/declarative/ruleset_221/ruleset_221.json`

##### AdGuard Chinese filter

EasyList China + AdGuard Chinese filter. Filter list that specifically removes ads on websites in Chinese language.

- Filter ID: **224**
- Path: `dist/filters/opera/declarative/ruleset_224/ruleset_224.json`

##### List-KR

Filter that removes ads and various scripts from websites with Korean content. Combined and augmented with AdGuard-specific rules for enhanced filtering. This filter is expected to be used alongside with AdGuard Base filter.

- Filter ID: **227**
- Path: `dist/filters/opera/declarative/ruleset_227/ruleset_227.json`

##### xinggsf

Blocks ads on the Chinese video platforms (MangoTV, DouYu and others).

- Filter ID: **228**
- Path: `dist/filters/opera/declarative/ruleset_228/ruleset_228.json`

##### EasyList Spanish

Additional filter list for websites in Spanish.

- Filter ID: **231**
- Path: `dist/filters/opera/declarative/ruleset_231/ruleset_231.json`

##### KAD - Anti-Scam

Filter that protects against various types of scams in the Polish network, such as mass text messaging, fake online stores, etc.

- Filter ID: **232**
- Path: `dist/filters/opera/declarative/ruleset_232/ruleset_232.json`

##### Adblock List for Finland

Finnish ad blocking filter list.

- Filter ID: **233**
- Path: `dist/filters/opera/declarative/ruleset_233/ruleset_233.json`

##### ROLIST2

This is a complementary list for ROList with annoyances that are not necessarily banners. It is a very aggressive list and not recommended for beginners.

- Filter ID: **234**
- Path: `dist/filters/opera/declarative/ruleset_234/ruleset_234.json`

##### Persian Blocker

Filter list for blocking ads and trackers on websites in Persian.

- Filter ID: **235**
- Path: `dist/filters/opera/declarative/ruleset_235/ruleset_235.json`

##### road-block light

Romanian ad blocking filter subscription.

- Filter ID: **236**
- Path: `dist/filters/opera/declarative/ruleset_236/ruleset_236.json`

##### Polish Annoyances Filters

Filter list that hides and blocks pop-ups, widgets, newsletters, push notifications, arrows, tagged internal links that are off-topic, and other irritating elements. Polish GDPR-Cookies Filters is already in it.

- Filter ID: **237**
- Path: `dist/filters/opera/declarative/ruleset_237/ruleset_237.json`

##### Polish Anti Adblock Filters

Official Polish filters against Adblock alerts.

- Filter ID: **238**
- Path: `dist/filters/opera/declarative/ruleset_238/ruleset_238.json`

##### Frellwit's Swedish Filter

Filter that aims to remove regional Swedish ads, tracking, social media, annoyances, sponsored articles etc.

- Filter ID: **243**
- Path: `dist/filters/opera/declarative/ruleset_243/ruleset_243.json`

##### YousList

Filter that blocks ads on Korean sites.

- Filter ID: **244**
- Path: `dist/filters/opera/declarative/ruleset_244/ruleset_244.json`

##### EasyList Polish

Additional filter list for websites in Polish.

- Filter ID: **246**
- Path: `dist/filters/opera/declarative/ruleset_246/ruleset_246.json`

##### Polish Anti-Annoying Special Supplement

Filters that block and hide RSS elements and remnants of hidden newsletters combined with social elements on Polish websites.

- Filter ID: **247**
- Path: `dist/filters/opera/declarative/ruleset_247/ruleset_247.json`

##### Dandelion Sprout's Nordic Filters

This list covers websites for Norway, Denmark, Iceland, Danish territories, and the Sami indigenous population.

- Filter ID: **249**
- Path: `dist/filters/opera/declarative/ruleset_249/ruleset_249.json`

##### Dandelion Sprout's Serbo-Croatian List

A filter list for websites in Serbian, Montenegrin, Croatian, and Bosnian.

- Filter ID: **252**
- Path: `dist/filters/opera/declarative/ruleset_252/ruleset_252.json`

##### IndianList

Additional filter list for websites in Hindi, Tamil and other Dravidian and Indic languages.

- Filter ID: **253**
- Path: `dist/filters/opera/declarative/ruleset_253/ruleset_253.json`

##### Macedonian adBlock Filters

Blocks ads and trackers on various Macedonian websites.

- Filter ID: **254**
- Path: `dist/filters/opera/declarative/ruleset_254/ruleset_254.json`

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
