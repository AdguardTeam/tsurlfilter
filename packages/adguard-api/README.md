# AdGuard API
**Version: 1.3.0**

AdGuard API is filtering library, provided following features:

- request and content filtering, using [@adguard/tswebextension](../tswebextension/README.md)
- filtering rules list management (downloading, caching and auto updates)
- content blocking via AdGuard Assistant UI
- auto detecting language filters
- logging request processing

## Table of content
- [AdGuard API](#adguard-api)
  - [Table of content](#table-of-content)
    - [Installation via `script` tag](#installation-via-script-tag)
    - [Module installation](#module-installation)
    - [Required web accessible resources](#required-web-accessible-resources)
  - [Configuration](#configuration)
  - [Static methods](#static-methods)
    - [`AdguardApi.create`](#adguardapicreate)
  - [Methods](#methods)
    - [`adguardApi.start`](#adguardapistart)
    - [`adguardApi.stop`](#adguardapistop)
    - [`adguardApi.configure`](#adguardapiconfigure)
    - [`adguardApi.openAssistant`](#adguardapiopenassistant)
    - [`adguardApi.closeAssistant`](#adguardapicloseassistant)
    - [`adguardApi.getRulesCount`](#adguardapigetrulescount)
    - [`adguardApi.onAssistantCreateRule`](#adguardapionassistantcreaterule)
    - [`adguardApi.onRequestBlocking`](#adguardapionrequestblocking)
  - [Usage](#usage)
  - [Minimum supported browser versions](#minimum-supported-browser-versions)

The library code can be loaded either via `script` tag or as an `npm` module.
### Installation via `script` tag

1. Copy `adguard-api.js`, `adguard-content.js`  and `adguard-assistant.js` scripts from `dist` to the directory near `manifest.json`

2. Create `adguard` directory near `manifest.json`

3. Place [web accessible resources](#required-web-accessible-resources) into `adguard` directory

4. Add AdGuard's content scripts to the manifest:
```
    {
      "all_frames": true,
      "js": ["adguard-content.js"],
      "matches": [
        "http://*/*",
        "https://*/*"
      ],
      "match_about_blank": true,
      "run_at": "document_start"
    }
```

5. Add AdGuard's script to the background page:
```
  <script type="text/javascript" src="adguard-api.js"></script>
```

AdGuard API is exposed through a `AdguardApi` class.

### Module installation

The preferred installation method for applications built using bundlers, such as webpack or rollup

1. Install `@adguard/api` module via `npm` or `yarn`
```
npm install @adguard/api
```
or
```
yarn add @adguard/api
```

2. Import `AdguardApi` class to background script
```
import { AdguardApi } from "@adguard/api";
```

3. Import `adguard-contents` in top of you content script entry

```
import '@adguard/api/content-script';
```

4. Import `adguard-assistant` in top of you assistant script entry

```
import '@adguard/api/assistant';
```

5. Add [web accessible resources](#required-web-accessible-resources) downloading in you build pipeline or load it manually

6. Setup manifest content-script with imported `adguard-contents` as follow

```
    {
      "all_frames": true,
      "js": [<YOUR content-script bundle>],
      "matches": [
        "http://*/*",
        "https://*/*"
      ],
      "match_about_blank": true,
      "run_at": "document_start"
    }
```

### Required web accessible resources

Adguard API requires [web accessible resources](https://developer.chrome.com/docs/extensions/mv3/manifest/web_accessible_resources/) from [Adguard Scriptlets library](https://github.com/AdguardTeam/Scriptlets#redirect-resources) for able to redirect web requests to a local "resource" using `$redirect` rule modifier. You can use [@adguard/tswebextenison CLI](../tswebextension/README.md#usage) for downloading it.

## Configuration

**Syntax:**
```typescript
type Configuration = {
    filters: number[],
    allowlist?: string[],
    blocklist?: string[],
    rules?: string[],
    filtersMetadataUrl: string,
    filterRulesUrl: string,
};
```

**Properties:**

- `filters` (mandatory) - An array of filters identifiers. You can look for possible filters identifiers in the [filters metadata file](https://filters.adtidy.org/extension/chromium/filters.json).

- `allowlist` (optional) - An array of domains, for which AdGuard won't work.

- `blocklist` (optional) - This property completely changes AdGuard behavior. If it is defined, Adguard will work for domains from the `blocklist` only. All other domains will be ignored. If `blocklist` is defined, `allowlist` will be ignored.

- `rules` (optional) - An array of custom filtering rules. Here is an [article](https://adguard.com/en/filterrules.html) describing filtering rules syntax. These custom rules might be created by a user via AdGuard Assistant UI.

- `filtersMetadataUrl` (mandatory) - An absolute path to a file, containing filters metadata. Once started, AdGuard will periodically check filters updates by downloading this file. Example: `https://filters.adtidy.org/extension/chromium/filters.json`.

- `filterRulesUrl` (mandatory) - URL mask used for fetching filters rules. `{filter_id}` parameter will be replaced with an actual filter identifier. Example: `https://filters.adtidy.org/extension/chromium/filters/{filter_id}.txt` (English filter (filter id = 2) will be loaded from: `https://filters.adtidy.org/extension/chromium/2.txt`)

**Example:**
```typescript

const configuration: Configuration = {
    filters: [],
    allowlist: [],
    blocklist: [],
    rules: [],
    filtersMetadataUrl: 'https://filters.adtidy.org/extension/chromium/filters.json',
    filterRulesUrl: 'https://filters.adtidy.org/extension/chromium/filters/{filter_id}.txt'
};
```

> **Please note, that we do not allow using `filters.adtidy.org` other than for testing purposes**. You have to use your own server for storing filters files. You can (and actually should) to use `filters.adtidy.org` for updating files on your side periodically.


## Static methods

Creates new `AdguardApi` instance.
### `AdguardApi.create`

**Syntax:**
```typescript
public static create(): AdguardApi
```

**Example:**
```typescript
const adguardApi = AdguardApi.create();
```

## Methods

### `adguardApi.start`

Initializes AdGuard and starts it immediately.

**Syntax:**
```typescript
public async start(configuration: Configuration): Promise<Configuration>
```

**Example:**
```typescript
const appliedConfiguration = await adguardApi.start(configuration);
```

**Parameters:**

- `configuration` - [API Configuration](#api-configuration)

**Returns:**

Promise, resolved with applied [API Configuration](#api-configuration) when api is initialized and filtering started

### `adguardApi.stop`

Completely stops AdGuard.

**Syntax:**
```typescript
public async stop(): Promise<void>
```

**Example:**
```typescript
await adguardApi.stop();
```

**Returns:**

Promise, resolved when API is completely stopped

### `adguardApi.configure`

This method modifies AdGuard configuration.

> Note, that Adguard must be already started (see [adguardApi.start](#adguardapistart)).

**Syntax:**
```typescript
public async configure(configuration: Configuration): Promise<Configuration>
```

**Example:**
```typescript
const updatedConfiguration = await adguardApi.configure(configuration);
```

**Parameters:**

- `configuration` - [API Configuration](#api-configuration)

**Returns:**

Promise, resolved with applied [API Configuration](#api-configuration) when api config is updated

### `adguardApi.openAssistant`

Opens the AdGuard Assistant UI in the specified tab. You should also subscribe on [onAssistantCreateRule](#adguardapionassistantcreaterule) event channel for applying rules, which are created by the Adguard Assistant.

**Syntax:**
```typescript
public async openAssistant(tabId: number): Promise<void>
```

**Example:**
```typescript
await adguardApi.openAssistant(tabId);
```

**Parameters:**

- `tabId` - `chrome.tabs.Tab` id. see: https://developer.chrome.com/docs/extensions/reference/tabs/#type-Tab

**Returns:**

Promise, resolved when Assistant UI is opened in specified tab

### `adguardApi.closeAssistant`

Closes AdGuard Assistant in the specified tab.

**Syntax:**
```typescript
public async openAssistant(tabId: number): Promise<void>
```

**Example:**
```typescript
await adguardApi.closeAssistant(tabId);
```

**Parameters:**

- `tabId` - `chrome.tabs.Tab` id. see: https://developer.chrome.com/docs/extensions/reference/tabs/#type-Tab

**Returns:**

Promise, resolved when Assistant UI id closed in specified tab

### `adguardApi.getRulesCount`

Gets current loaded rules count.

**Syntax:**
```typescript
public getRulesCount(): number
```

**Example:**
```typescript
adguardApi.getRulesCount();
```

**Returns:**

rules count number

### `adguardApi.onAssistantCreateRule`

TsWebExtension Event channel, which fires event on Assistant rule creation.

**Syntax:**

```typescript
public onAssistantCreateRule: EventChannel<string>;
```

**Example:**

```typescript

// update config on Assistant rule apply
const applyRule = async (rule): Promise<void> => {
  console.log(`Rule ${rule} was created by Adguard Assistant`);
  configuration.rules!.push(rule);
  await adguardApi.configure(configuration);
};

// add listener
adguardApi.onAssistantCreateRule.subscribe(applyRule);

// remove listener
adguardApi.onAssistantCreateRule.unsubscribe(applyRule);
```

### `adguardApi.onRequestBlocking`

API for adding and removing listeners for request blocking events.

**Syntax:**
```typescript
export interface RequestBlockingLoggerInterface {
    addListener(listener: EventChannelListener<RequestBlockingEvent>): void;
    removeListener(listener: EventChannelListener<RequestBlockingEvent>): void;
}
```

**Example:**
```typescript
// Registers an event listener
adguardApi.onRequestBlocked.addListener(
  callback // function, mandatory
)
// Removes specified event listener
adguardApi.onRequestBlocked.removeListener(
  callback // function, mandatory
)
```


**Callback parameter properties:**

- `tabId` - Tab identifier.
- `requestUrl` -Blocked request URL.
- `referrerUrl` -Referrer URL.
- `rule` - Filtering rule, which has blocked this request.
- `filterId` - Rule's filter identifier.
- `requestType` - Request mime type. Possible values are listed below:

> Request types:
> - `DOCUMENT` - top-level frame document.
> - `SUBDOCUMENT` - document loaded in a nested frame.
> - `SCRIPT`
> - `STYLESHEET`
> - `OBJECT`
> - `IMAGE`
> - `XMLHTTPREQUEST`
> - `MEDIA`
> - `FONT`
> - `WEBSOCKET`
> - `OTHER`

## Usage

See full sample app project in [examples/adguard-api](../examples/adguard-api/)

```typescript
import { AdguardApi, Configuration, RequestBlockingEvent } from "@adguard/api";

(async (): Promise<void> => {
    // create new AdguardApi instance
    const adguardApi = AdguardApi.create();

    const configuration: Configuration = {
        filters: [2],
        allowlist: ["www.example.com"],
        rules: ["example.org##h1"],
        filterRulesUrl: "https://filters.adtidy.org/extension/chromium/filters/{filter_id}.txt",
        filtersMetadataUrl: "https://filters.adtidy.org/extension/chromium/filters.json",
    };

    // console log event on request blocking
    const onRequestBlocked = (event: RequestBlockingEvent) => {
        console.log(event);
    };

    // console log current rules count, loaded in engine
    const logTotalCount = (): void => {
        console.log("Total rules count:", adguardApi.getRulesCount());
    };

    adguardApi.onRequestBlocked.addListener(onRequestBlocked);

    await adguardApi.start(configuration);

    console.log("Finished Adguard API initialization.");
    logTotalCount();

    configuration.allowlist!.push("www.google.com");

    await adguardApi.configure(configuration);

    console.log("Finished Adguard API re-configuration");
    logTotalCount();

    // update config on Assistant rule apply
    adguardApi.onAssistantCreateRule.subscribe(async (rule) => {
        console.log(`Rule ${rule} was created by Adguard Assistant`);
        configuration.rules!.push(rule);
        await adguardApi.configure(configuration);
        console.log("Finished Adguard API re-configuration");
        logTotalCount();
    });

    chrome.runtime.onMessage.addListener(async (message) => {
        switch (message.type) {
            case "OPEN_ASSISTANT": {
                chrome.tabs.query({ active: true }, async (res) => {
                    if (res[0]?.id) {
                        await adguardApi.openAssistant(res[0].id);
                    }
                });
                break;
            }
            default:
            // do nothing
        }
    });

    // Disable Adguard in 1 minute
    setTimeout(async () => {
        adguardApi.onRequestBlocked.removeListener(onRequestBlocked);
        await adguardApi.stop();
        console.log("Adguard API has been disabled.");
    }, 60 * 1000);
})();
```
## Minimum supported browser versions
| Browser                 	| Version 	 |
|-------------------------	|:---------:|
| Chromium Based Browsers 	|  79   	   |
| Firefox                 	|  78   	   |
| Opera                   	|  66   	   |
| Edge                    	|  79   	   |
