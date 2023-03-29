# TSWebExtension

TypeScript library that wraps webextension api for tsurlfilter library.

Table of content:
- [TSWebExtension](#tswebextension)
  - [Browser support](#browser-support)
  - [Install](#install)
  - [Usage](#usage)
  - [CLI](#cli)
  - [API](#api)
    - [configuration](#configuration)
      - [filters (MV2 only)](#filters-mv2-only)
        - [filterId](#filterid)
        - [content](#content)
        - [trusted](#trusted)
      - [staticFiltersIds (MV3 only)](#staticfiltersids-mv3-only)
      - [customFilters (MV3 only)](#customfilters-mv3-only)
        - [filterId](#filterid-1)
        - [content](#content-1)
      - [filtersPath (MV3 only)](#filterspath-mv3-only)
      - [ruleSetsPath (MV3 only)](#rulesetspath-mv3-only)
      - [filteringLogEnabled (MV3 only)](#filteringlogenabled-mv3-only)
      - [allowlist](#allowlist)
      - [trustedDomains](#trusteddomains)
      - [userrules](#userrules)
      - [verbose](#verbose)
      - [settings](#settings)
        - [allowlistInverted](#allowlistinverted)
        - [allowlistEnabled](#allowlistenabled)
        - [collectStats](#collectstats)
        - [stealthModeEnabled](#stealthmodeenabled)
        - [filteringEnabled](#filteringenabled)
        - [documentBlockingPageUrl](#documentblockingpageurl)
        - [assistantUrl](#assistanturl)
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
        - [start](#start)
        - [configure](#configure)
        - [stop](#stop)
        - [openAssistant](#openassistant)
        - [closeAssistant](#closeassistant)
        - [getRulesCount](#getrulescount)
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
      - [JsInject](#jsinject)
    - [properties](#properties-1)
      - [onLogEvent](#onlogevent)
    - [methods](#methods-1)
      - [addEventListener](#addeventlistener)
      - [publishEvent](#publishevent)
  - [Development](#development)


## Browser support

|                |manifest v2   |manifest v3  |
|----------------|--------------|-------------|
| Chrome         | ✅           | 🚧
| Firefox        | ✅           | 🚧

## Install

```sh
yarn add @adguard/tswebextension
```
## Usage

You can find examples in `packages/examples/tswebextension-*`


**Note:**

Before running compiled app, load the web accessible resources for redirect rules

via built-in cli:

```sh
 tswebextension war [path]
```

or intergrate loading in your build pipeline:

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

```
Usage: tswebextension-utils [options] [command]

CLI to some development utils

Options:
  -V, --version   output the version number
  -h, --help      display help for command

Commands:
  war [path]      Downloads web accessible resources for
                  redirect rules
  help [command]  display help for command
```


## API

The main idea of the library is to provide a common interface for different browsers and manifest versions. 
via [Configuration](#configuration) object.

[TsWebExtension](#tswebextension-1) class provides a set of methods for filtering content from the extension's background context.

MV2 submodule also provides a set of methods for [filtering log management](#filtering-log-api-mv2-only).

### configuration

type: `Configuration`

Configuration object.

#### filters (MV2 only)

type: `FilterMV2[]`

List of filters.

##### filterId

type: `number`

Filter identifier.

##### content

type: `string`

Filter list text string.

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

##### content

type: `string`

Filter list text string.

#### filtersPath (MV3 only)

type: `string`

Path to the filter list file.

#### ruleSetsPath (MV3 only)

type: `string`

Path to directory with converted rule sets. 

#### filteringLogEnabled (MV3 only)

type: `boolean`

Enables filtering log if true.

#### allowlist

type: `string[]`

List of hostnames or domains of sites, which should be excluded from blocking or which should be included in blocking depending on the value of [allowlistInverted](#allowlistinverted) setting value.

#### trustedDomains

type: `string[]`

List of domain names of sites, which should be temporary excluded from document blocking.

#### userrules

type: `string[]`

List of rules added by user.

#### verbose

type: `boolean`

Flag responsible for logging.

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

##### stealthModeEnabled

type: `boolean`

Enables stealth mode if true.

##### filteringEnabled

type: `boolean`

Enables filtering if true.

##### documentBlockingPageUrl

type: `string`

Redirect url for $document rules.

##### assistantUrl

type: `string`

Path to the assembled `@adguard/assistant` module. Necessary for lazy on-demand loading of the assistant.

##### stealthConfig

type: `StealthConfig`

Stealth mode configuration object.

###### selfDestructFirstPartyCookies

type: `boolean`

Should the application set a fixed lifetime from [selfDestructFirstPartyCookiesTime](#selfDestructFirstPartyCookiesTime) for first-party cookies.

###### selfDestructFirstPartyCookiesTime

type: `number`

Time in minutes to delete first-party cookies.

###### selfDestructThirdPartyCookies

type: `boolean`

Should the application set a fixed lifetime from [selfDestructThirdPartyCookiesTime](#selfDestructThirdPartyCookiesTime) for third-party cookies.

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

Read more about DNT: https://en.wikipedia.org/wiki/Do_Not_Track.

Read more about GPC: https://globalprivacycontrol.org.

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

##### start

type: `(configuration: TConfiguration) => Promise<TConfigurationResult>`

Starts the app.

##### configure

type: `(configuration: TConfiguration) => Promise<TConfigurationResult>`

Updates the configuration.

##### stop

type: `() => Promise<void>`

Stops the app.

##### openAssistant

type: `(tabId: number) => void`

Opens the assistant in the specified tab.

##### closeAssistant

type: `(tabId: number) => void`

##### getRulesCount

type: `() => number`

Returns number of active rules.

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

#### JsInject

type: `JsInjectEvent`

Dispatched on js inject into page context.

### properties

#### onLogEvent

type: `EventChannel<FilteringLogEvent>`

Event channel for [filtering log events](#filtering-log-api-mv2-only).

### methods
#### addEventListener

type: 
```
<T extends FilteringEventType>(type: T, listener: FilteringLogListener<ExtractedFilteringLogEvent<T>>) => void
```

Registers a listener for the specified filtering event type.

#### publishEvent

type:
```
<T extends FilteringLogEvent>(event: T) => void
```

Dispatch the specified filtering event.

## Development

This project is part of the `tsurlfilter` monorepo.
It is highly recommended to use both `lerna` and `nx` for commands, as it will execute scripts in the correct order and can cache dependencies.

run module tests

```sh
npx nx run @adguard/tswebextension:test
```

run build

```sh
npx nx run @adguard/tswebextension:build
```

lint source code

```
npx nx run @adguard/tswebextension:lint
```
