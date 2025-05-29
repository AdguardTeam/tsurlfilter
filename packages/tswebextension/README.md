# TSWebExtension

TypeScript library that wraps webextension api for tsurlfilter library.

Table of content:

- [TSWebExtension](#tswebextension)
    - [Browser compatibility](#browser-compatibility)
    - [Install](#install)
    - [Usage](#usage)
    - [CLI](#cli)
    - [Side effects](#side-effects)
    - [API](#api)
        - [configuration](#configuration)
            - [TSWEBEXTENSION\_VERSION](#tswebextension_version)
            - [EXTENDED\_CSS\_VERSION](#extended_css_version)
            - [filters (MV2 only)](#filters-mv2-only)
                - [filterId](#filterid)
                - [content](#content)
                - [trusted](#trusted)
            - [staticFiltersIds (MV3 only)](#staticfiltersids-mv3-only)
            - [customFilters (MV3 only)](#customfilters-mv3-only)
                - [filterId](#filterid-1)
                - [rawFilterList](#rawfilterlist)
                - [sourceMap](#sourcemap)
                - [conversionMap](#conversionmap)
                - [content](#content-1)
            - [filtersPath (MV3 only)](#filterspath-mv3-only)
            - [ruleSetsPath (MV3 only)](#rulesetspath-mv3-only)
            - [declarativeLogEnabled (MV3 only)](#declarativelogenabled-mv3-only)
            - [quickFixesRules (MV3 only)](#quickfixesrules-mv3-only)
                - [rawFilterList](#rawfilterlist-1)
                - [sourceMap](#sourcemap-1)
                - [conversionMap](#conversionmap-1)
                - [content](#content-2)
            - [allowlist](#allowlist)
            - [trustedDomains](#trusteddomains)
            - [userrules (MV2)](#userrules-mv2)
                - [content](#content-3)
                - [sourceMap](#sourcemap-2)
            - [userrules (MV3)](#userrules-mv3)
                - [rawFilterList](#rawfilterlist-2)
                - [sourceMap](#sourcemap-3)
                - [conversionMap](#conversionmap-2)
                - [content](#content-4)
            - [verbose (deprecated)](#verbose-deprecated)
            - [logLevel](#loglevel)
            - [settings](#settings)
                - [allowlistInverted](#allowlistinverted)
                - [allowlistEnabled](#allowlistenabled)
                - [collectStats](#collectstats)
                - [debugScriptlets](#debugscriptlets)
                - [stealthModeEnabled](#stealthmodeenabled)
                - [filteringEnabled](#filteringenabled)
                - [documentBlockingPageUrl](#documentblockingpageurl)
                - [assistantUrl](#assistanturl)
                - [gpcScriptUrl (MV3 only)](#gpcscripturl-mv3-only)
                - [hideDocumentReferrerScriptUrl (MV3 only)](#hidedocumentreferrerscripturl-mv3-only)
                - [stealthConfig](#stealthconfig)
                    - [selfDestructFirstPartyCookies](#selfdestructfirstpartycookies)
                    - [selfDestructFirstPartyCookiesTime](#selfdestructfirstpartycookiestime)
                    - [selfDestructThirdPartyCookies](#selfdestructthirdpartycookies)
                    - [selfDestructThirdPartyCookiesTime](#selfdestructthirdpartycookiestime)
                    - [hideReferrer](#hidereferrer)
                    - [hideSearchQueries](#hidesearchqueries)
                    - [blockChromeClientData](#blockchromeclientdata)
                    - [sendDoNotTrack](#senddonottrack)
                    - [blockWebRTC](#blockwebrtc)
        - [TsWebExtension](#tswebextension-1)
            - [Properties](#properties)
                - [configuration](#configuration-1)
                - [onFilteringLogEvent](#onfilteringlogevent)
                - [isStarted](#isstarted)
            - [Methods](#methods)
                - [initStorage()](#initstorage)
                - [start()](#start)
                - [configure()](#configure)
                - [stop()](#stop)
                - [openAssistant()](#openassistant)
                - [closeAssistant()](#closeassistant)
                - [getRulesCount()](#getrulescount)
                - [retrieveRuleNode](#retrieverulenode)
                - [getMessageHandler()](#getmessagehandler)
                - [setFilteringEnabled() (MV2 only)](#setfilteringenabled-mv2-only)
                - [setCollectHitStats() (MV2 only)](#setcollecthitstats-mv2-only)
                - [setDebugScriptlets()](#setdebugscriptlets)
                - [setStealthModeEnabled() (MV2 only)](#setstealthmodeenabled-mv2-only)
                - [setSelfDestructFirstPartyCookies() (MV2 only)](#setselfdestructfirstpartycookies-mv2-only)
                - [setSelfDestructThirdPartyCookies() (MV2 only)](#setselfdestructthirdpartycookies-mv2-only)
                - [setSelfDestructFirstPartyCookiesTime() (MV2 only)](#setselfdestructfirstpartycookiestime-mv2-only)
                - [setSelfDestructThirdPartyCookiesTime() (MV2 only)](#setselfdestructthirdpartycookiestime-mv2-only)
                - [setHideReferrer() (MV2 only)](#sethidereferrer-mv2-only)
                - [setHideSearchQueries() (MV2 only)](#sethidesearchqueries-mv2-only)
                - [setBlockChromeClientData() (MV2 only)](#setblockchromeclientdata-mv2-only)
                - [setSendDoNotTrack() (MV2 only)](#setsenddonottrack-mv2-only)
                - [setBlockWebRTC() (MV2 only)](#setblockwebrtc-mv2-only)
                - [getRawFilterList() (MV3 only)](#getrawfilterlist-mv3-only)
                - [getPreprocessedFilterList() (MV3 only)](#getpreprocessedfilterlist-mv3-only)
                - [isUserScriptsApiSupported](#isuserscriptsapisupported)
    - [Filtering Log API (MV2 only)](#filtering-log-api-mv2-only)
        - [events](#events)
            - [sendRequest](#sendrequest)
            - [tabReload](#tabreload)
            - [applyBasicRule](#applybasicrule)
            - [applyCosmeticRule](#applycosmeticrule)
            - [applyCspRule](#applycsprule)
            - [receiveResponse](#receiveresponse)
            - [cookie](#cookie)
            - [removeHeader](#removeheader)
            - [removeParam](#removeparam)
            - [replaceRuleApply](#replaceruleapply)
            - [contentFilteringStart](#contentfilteringstart)
            - [contentFilteringFinish](#contentfilteringfinish)
            - [stealthAction](#stealthaction)
            - [stealthAllowlistAction](#stealthallowlistaction)
            - [JsInject](#jsinject)
        - [properties](#properties-1)
            - [onLogEvent](#onlogevent)
        - [methods](#methods-1)
            - [addEventListener()](#addeventlistener)
            - [publishEvent()](#publishevent)
    - [Development](#development)

## Browser compatibility

| Browser                     | Version |
|-----------------------------|---------|
| Chromium-based browsers MV2 | 106     |
| Chromium-based browsers MV3 | 121     |
| Firefox                     | 78      |
| Firefox Mobile              | 113     |

## Install

```sh
pnpm add @adguard/tswebextension
```

## Usage

You can find examples in `packages/examples/tswebextension-*`

**Note:**

Before running compiled app, load the web accessible resources for redirect rules

via built-in cli:

```sh
tswebextension war [path]
```

or integrate loading in your build pipeline:

```ts
import { copyWar, DEFAULT_WAR_PATH } from '@adguard/tswebextension/cli';

const build = async () => {
    ...
    await copyWar(DEFAULT_WAR_PATH);
    ...
};
```

If path is not defined, the resources will be loaded to `build/war` relative to your current working directory by default

## CLI

The console interface provides useful tools for building extensions.

```text
Usage: tswebextension [options] [command]

CLI to some development utils

Options:
    -V, --version     output the version number
    -h, --help        display help for command

Commands:
    war [path]        Downloads web accessible resources for redirect rules
    help [command]    display help for command
```

## Side effects

In this project, the `sideEffects` field is defined as follows in the `package.json` file:

```json
"sideEffects": [
    "dist/assistant-inject.js",
    "dist/content-script.js",
    "dist/content-script.mv3.js",
    "dist/gpc.mv3.js",
    "dist/hide-document-referrer.mv3.js"
]
```

This configuration indicates that the specified files have side effects and should not be tree-shaken by the bundler. These files will modifying the global scope, which are essential for the correct functioning of the application.

By explicitly listing these files, we ensure that they are included in the final bundle, even if they do not have any direct imports or exports that are used elsewhere in the codebase.

In the content script, we need access to `@adguard/assistant` only when the user clicks 'block ad manually'. Therefore, we marked files with `@adguard/assistant` as side effects. We also added a required field to the configuration object to ensure the assistant is bundled inside the final extension, allowing `tswebextension` to load it on-demand.

Same approach with dynamic injecting we use for stealth options GPC and Hide
Document Referrer. Handlers for these options will dynamically register content
scripts via `scripting.registerContentScript`.

## API

The main idea of the library is to provide a common interface for different browsers and manifest versions.
via [Configuration](#configuration) object.

[TsWebExtension](#tswebextension-1) class provides a set of methods for filtering content from the extension's background context.

MV2 submodule also provides a set of methods for [filtering log management](#filtering-log-api-mv2-only).

### configuration

type: `Configuration`

Configuration object.

#### TSWEBEXTENSION_VERSION

type: `string`

Version of the library.

#### EXTENDED_CSS_VERSION

type: `string`

Version of the extended css module, used in current library version.

#### filters (MV2 only)

type: `FilterMV2[]`

List of filters.

##### filterId

type: `number`

Filter identifier.

##### content

type: `Uint8Array[]`

AGTree byte buffer chunks.

##### trusted

type: `boolean`

Determines if filter list js rules should be executed.

#### staticFiltersIds (MV3 only)

type: `number[]`

List of static filters ids.

#### customFilters (MV3 only)

type: `CustomFilterMV3[]`

List of custom filters that can be added/edited/deleted by the user.

##### filterId

type: `number`

Filter identifier.

##### rawFilterList

type: `string`

Raw filter list.

##### sourceMap

type: `Record<string, number>`

Source map, where key is the rule start index in the byte buffer `content` and value is the line start index in the raw filter list.

##### conversionMap

type: `Record<string, string>`

Conversion map, where key is the line start index in the raw filter list and value is the rule text.

##### content

type: `Uint8Array[]`

AGTree byte buffer chunks.

#### filtersPath (MV3 only)

type: `string`

Path to the filter list file.

#### ruleSetsPath (MV3 only)

type: `string`

Path to directory with converted rule sets.

#### declarativeLogEnabled (MV3 only)

type: `boolean`

Enables matching declarative rules for filtering log.

#### quickFixesRules (MV3 only)

type: `preprocessedFilterList`

Contains rules from AdGuard Quick Fixes rules which will applied in the dynamic
rules between all other dynamic rules: allowlist, userrules and custom filters.

##### rawFilterList

type: `string`

Raw filter list.

##### sourceMap

type: `Record<string, number>`

Source map, where key is the rule start index in the byte buffer `content` and value is the line start index in the raw filter list.

##### conversionMap

type: `Record<string, string>`

Conversion map, where key is the line start index in the raw filter list and value is the rule text.

##### content

type: `Uint8Array[]`

AGTree byte buffer chunks.

#### allowlist

type: `string[]`

List of hostnames or domains of sites, which should be excluded from blocking or which should be included in blocking depending on the value of [allowlistInverted](#allowlistinverted) setting value.

#### trustedDomains

type: `string[]`

For MV2:
List of domain names of sites, which should be temporary excluded from document blocking.

For MV3:
List of blocking rules which should be temporarily badfiltered
since user clicked "Proceed anyway" button on the blocking page.

#### userrules (MV2)

##### content

type: `Uint8Array[]`

AGTree byte buffer chunks.

##### sourceMap

type: `Record<string, number> | undefined`

Source map, where key is the rule start index in the byte buffer `content` and value is the line start index in the raw filter list.
Optional field, can be omitted.

#### userrules (MV3)

##### rawFilterList

type: `string`

Raw filter list.

##### sourceMap

type: `Record<string, number>`

Source map, where key is the rule start index in the byte buffer `content` and value is the line start index in the raw filter list.

##### conversionMap

type: `Record<string, string>`

Conversion map, where key is the line start index in the raw filter list and value is the rule text.

##### content

type: `Uint8Array[]`

AGTree byte buffer chunks.

#### <a name="verbose"></a>verbose (deprecated)

type: `boolean | undefined`

Optional flag responsible for logging. Defaults to true. Will be removed in the next minor version.

#### logLevel

type: `string | undefined`

Optional flag that sets logging level, defaults to 'error'. Available levels: 'error', 'warn', 'info', 'debug', 'trace'.

#### settings

type: `SettingsConfig`

Settings configuration object.

##### allowlistInverted

type: `boolean`

If this flag is true, the application will work ONLY with domains from the [allowlist](#allowlist), otherwise it will work everywhere EXCLUDING domains from the list.

##### allowlistEnabled

type: `boolean`

Flag specifying [allowlist](#allowlist) enable state. We don't use allowlist array length condition for calculate enable state, because it's not cover case with empty list in inverted mode.

##### collectStats

type: `boolean`

Enables css hits counter if true.

##### debugScriptlets

Optional, type: `boolean`

Defaults to false. Enables scriptlets logging in console if true.

##### stealthModeEnabled

type: `boolean`

Enables stealth mode if true.

##### filteringEnabled

type: `boolean`

Enables filtering if true.

##### documentBlockingPageUrl

type: `string`

Redirect url for blocking rules with `$document` modifier.

##### assistantUrl

type: `string`

Path to the assembled `@adguard/assistant` module. Necessary for lazy on-demand loading of the assistant.

##### gpcScriptUrl (MV3 only)

type: `string`

Path to the content script that set GPC Signal. Necessary for `Do Not Track` stealth option.

##### hideDocumentReferrerScriptUrl (MV3 only)

type: `string`

Path to the content script that hides the document referrer. Necessary for `Hide Search Queries` stealth option.

##### stealthConfig

type: `StealthConfig`

Stealth mode configuration object.

###### selfDestructFirstPartyCookies

type: `boolean`

Should the application set a fixed lifetime from [selfDestructFirstPartyCookiesTime](#selfdestructfirstpartycookiestime) for first-party cookies.

###### selfDestructFirstPartyCookiesTime

type: `number`

Time in minutes to delete first-party cookies.

###### selfDestructThirdPartyCookies

type: `boolean`

Should the application set a fixed lifetime from [selfDestructThirdPartyCookiesTime](#selfdestructthirdpartycookiestime) for third-party cookies.

###### selfDestructThirdPartyCookiesTime

type: `number`

Time in minutes to delete third-party cookies.

###### hideReferrer

type: `boolean`

Should the application hide the origin referrer in third-party requests by replacing the referrer url with the request url.

###### hideSearchQueries

type: `boolean`

Should the application hide the original referrer from the search page containing the search query in third-party queries, replacing the referrer url with the request url.

###### blockChromeClientData

type: `boolean`

For Google Chrome, it removes the 'X-Client-Data' header from the requests, which contains information about the browser version and modifications.

###### sendDoNotTrack

type: `boolean`

Includes HTTP headers 'DNT' and 'Sec-GPC' in all requests.

Read more about DNT: <https://en.wikipedia.org/wiki/Do_Not_Track>.

Read more about GPC: <https://globalprivacycontrol.org>.

###### blockWebRTC

type: `boolean`

Blocks the possibility of leaking your IP address through WebRTC, even if you use a proxy server or VPN.

### TsWebExtension

#### Properties

##### configuration

type: `ConfigurationMV2Context | ConfigurationMV3Context`

Configuration context with an omitted array of rule and domain strings loaded in the filter engine.

It is used to reduce memory consumption when storing configuration data in memory.

##### onFilteringLogEvent

type: `EventChannel<FilteringLogEvent>`

Event channel for [filtering log events](#filtering-log-api-mv2-only).

##### isStarted

type: `boolean`

Is app started.

#### Methods

##### initStorage()

type: `() => Promise<void>`

Initialize app persistent data. This method called as soon as possible and allows access to the actual context before the app is started.

##### start()

type: `(configuration: TConfiguration) => Promise<TConfigurationResult>`

Starts the app.

Also updates webRTC privacy.network settings on demand and flushes browser in-memory request cache.

##### configure()

type: `(configuration: TConfiguration) => Promise<TConfigurationResult>`

Updates the configuration.

Also updates webRTC privacy.network settings on demand and flushes browser in-memory request cache.

##### stop()

type: `() => Promise<void>`

Stops the app.

##### openAssistant()

type: `(tabId: number) => void`

Opens the assistant in the specified tab.

##### closeAssistant()

type: `(tabId: number) => void`

##### getRulesCount()

type: `() => number`

Returns number of active rules.

##### retrieveRuleNode

type: `(filterId: number, ruleIndex: number): AnyRule | null`

Retrieves rule node from engine by filter id and rule index.

##### getMessageHandler()

type: `() => MessageHandlerMV2 | MessageHandlerMV3`

Returns a message handler that will listen to internal messages, for example: message for get computed css for content-script.

##### setFilteringEnabled() (MV2 only)

type: `(isFilteringEnabled: boolean) => Promise<void>`

Updates [filteringEnabled](#filteringenabled) configuration value without re-initialization of engine.

Also updates webRTC privacy.network settings on demand and flushes browser in-memory request cache.

Throws error if [configuration](#configuration) is not set.

##### setCollectHitStats() (MV2 only)

type: `(isCollectStats: boolean) => void`

Updates [collectStats](#collectstats) configuration value without re-initialization of engine.

Throws error if [configuration](#configuration) is not set.

##### setDebugScriptlets()

type: `(isDebugScriptlets: boolean) => void`

Updates [debugScriptlets](#debugscriptlets) configuration value
without re-initialization of engine.

Throws error if [configuration](#configuration) is not set.

##### setStealthModeEnabled() (MV2 only)

type: `(value: isStealthModeEnabled) => Promise<void>`

Updates [stealthModeEnabled](#stealthmodeenabled) configuration value without re-initialization of engine.

Also updates webRTC privacy.network settings on demand.

Throws error if [configuration](#configuration) is not set.

##### setSelfDestructFirstPartyCookies() (MV2 only)

type: `(isSelfDestructFirstPartyCookies: boolean) => void`

Updates [selfDestructFirstPartyCookies](#selfdestructfirstpartycookies) stealth config value without re-initialization of engine.

Throws error if [configuration](#configuration) is not set.

##### setSelfDestructThirdPartyCookies() (MV2 only)

type: `(isSelfDestructThirdPartyCookies: boolean) => void`

Updates [selfDestructThirdPartyCookies](#selfdestructthirdpartycookies) stealth config value without re-initialization of engine.

Throws error if [configuration](#configuration) is not set.

##### setSelfDestructFirstPartyCookiesTime() (MV2 only)

type: `(selfDestructFirstPartyCookiesTime: number) => void`

Updates [selfDestructFirstPartyCookiesTime](#selfdestructfirstpartycookiestime) stealth config value without re-initialization of engine.

Throws error if [configuration](#configuration) is not set.

##### setSelfDestructThirdPartyCookiesTime() (MV2 only)

type: `(selfDestructThirdPartyCookiesTime: number) => void`

Updates [selfDestructThirdPartyCookiesTime](#selfdestructthirdpartycookiestime) stealth config value without re-initialization of engine.

Throws error if [configuration](#configuration) is not set.

##### setHideReferrer() (MV2 only)

type: `(isHideReferrer: boolean) => void`

Updates [hideReferrer](#hidereferrer) stealth config value without re-initialization of engine.

Throws error if [configuration](#configuration) is not set.

##### setHideSearchQueries() (MV2 only)

type: `(isHideSearchQueries: boolean) => void`

Updates [hideSearchQueries](#hidesearchqueries) stealth config value without re-initialization of engine.

Throws error if [configuration](#configuration) is not set.

##### setBlockChromeClientData() (MV2 only)

type: `(isBlockChromeClientData: boolean) => void`

Updates [blockChromeClientData](#blockchromeclientdata) stealth config value without re-initialization of engine.

Throws error if [configuration](#configuration) is not set.

##### setSendDoNotTrack() (MV2 only)

type: `(isSendDoNotTrack: boolean) => void`

Updates [sendDoNotTrack](#senddonottrack) stealth config value without re-initialization of engine.

Throws error if [configuration](#configuration) is not set.

##### setBlockWebRTC() (MV2 only)

type: `(isBlockWebRTC: boolean) => Promise<void>`

Updates [blockWebRTC](#blockwebrtc) stealth config value without re-initialization of engine.

Also updates webRTC privacy.network settings on demand.

Throws error if [configuration](#configuration) is not set.

##### getRawFilterList() (MV3 only)

type: `async (filterId: number, ruleSetsPath: string): Promise<string>`

Returns raw filter list for the specified filter id via the rule sets loader.

Throws error if rule sets path is not set.

##### getPreprocessedFilterList() (MV3 only)

type: `async (filterId: number, ruleSetsPath: string): Promise<PreprocessedFilterList>`

Returns preprocessed filter list for the specified filter id via the rule sets loader.

Throws error if rule sets path is not set.

> [!NOTE]
> You can learn more about the preprocessed filter list in the
> [tsurlfilter documentation][tsurlfilter-preprocessed-filter-list].

[tsurlfilter-preprocessed-filter-list]: https://github.com/AdguardTeam/tsurlfilter/tree/master/packages/tsurlfilter#preprocessedfilterlist-interface

##### isUserScriptsApiSupported

type: `static get property`
return type: `boolean`

Indicates whether user scripts API is supported in the current browser. Returns `true` if the user scripts API is supported, `false` otherwise.

## Filtering Log API (MV2 only)

Provides a set of methods for [filtering log events](#filtering-log-api-mv2-only) management.

### events

#### sendRequest

type: `SendRequestEvent`

Dispatched on request sending.

#### tabReload

type: `TabReloadEvent`

Dispatched on tab reload.

#### applyBasicRule

type: `ApplyBasicRuleEvent`

Dispatched on request block or allowlist rule matching.

#### applyCosmeticRule

type: `ApplyCosmeticRuleEvent`

Dispatched on elemhide, css or html rule applying.

#### applyCspRule

type: `ApplyCspRuleEvent`

Dispatched on csp rule applying.

#### receiveResponse

type: `ReceiveResponseEvent`

Dispatched on response receiving.

#### cookie

type: `CookieEvent`

Dispatched on cookie removing or modifying.

#### removeHeader

type: `RemoveHeaderEvent`

Dispatched on request or response header removing.

#### removeParam

type: `RemoveParamEvent`

Dispatched on request or response param removing.

#### replaceRuleApply

type: `ReplaceRuleApplyEvent`

Dispatched on replace rule applying.

#### contentFilteringStart

type: `ContentFilteringStartEvent`

Dispatched on content filtering start.

#### contentFilteringFinish

type: `ContentFilteringFinishEvent`

Dispatched on content filtering end.

#### stealthAction

type: `StealthActionEvent`

Dispatched on stealth action.

#### stealthAllowlistAction

type: `StealthAllowlistActionEvent`

Dispatched on preventing stealth action with `$stealth` rule.

#### JsInject

type: `JsInjectEvent`

Dispatched on js inject into page context.

### properties

#### onLogEvent

type: `EventChannel<FilteringLogEvent>`

Event channel for [filtering log events](#filtering-log-api-mv2-only).

### methods

#### addEventListener()

type:

```ts
<T extends FilteringEventType>(type: T, listener: FilteringLogListener<ExtractedFilteringLogEvent<T>>) => void
```

Registers a listener for the specified filtering event type.

#### publishEvent()

type:

```ts
<T extends FilteringLogEvent>(event: T) => void
```

Dispatch the specified filtering event.

## Development

This project is part of the `@adguard/extensions` monorepo.
It is highly recommended to use `lerna` for commands, as it will execute scripts in the correct order and can cache dependencies.

Run module tests

```sh
npx lerna run --scope=@adguard/tswebextension test
```

Run build

```sh
npx lerna run --scope=@adguard/tswebextension build
```

> Note that during the build simplified [companiesdb] data — `trackers-min.ts` — is to be updated.

Lint source code

```sh
npx lerna run --scope=@adguard/tswebextension lint
```

[companiesdb]: https://github.com/AdguardTeam/companiesdb
