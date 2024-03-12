# AdGuard API
**Version: 2.1.0**

AdGuard API is filtering library, provided following features:

- request and content filtering, using [@adguard/tswebextension](../tswebextension/README.md)
- filtering rules list management (downloading, caching and auto updates)
- content blocking via AdGuard Assistant UI
- auto detecting language filters
- logging request processing

## Table of content
- [AdGuard API](#adguard-api)
  - [Table of content](#table-of-content)
    - [Installation](#installation)
    - [Required web accessible resources](#required-web-accessible-resources)
  - [Configuration](#configuration)
  - [Static methods](#static-methods)
    - [`AdguardApi.create`](#adguardapicreate)
  - [Methods](#methods)
    - [`adguardApi.getMessageHandler`](#adguardapigetmessagehandler)
    - [`adguardApi.start`](#adguardapistart)
    - [`adguardApi.stop`](#adguardapistop)
    - [`adguardApi.configure`](#adguardapiconfigure)
    - [`adguardApi.setFilteringEnabled`](#adguardapisetfilteringenabled)
    - [`adguardApi.openAssistant`](#adguardapiopenassistant)
    - [`adguardApi.closeAssistant`](#adguardapicloseassistant)
    - [`adguardApi.getRulesCount`](#adguardapigetrulescount)
    - [`adguardApi.onAssistantCreateRule`](#adguardapionassistantcreaterule)
    - [`adguardApi.onRequestBlocking`](#adguardapionrequestblocking)
  - [Usage](#usage)
  - [Minimum supported browser versions](#minimum-supported-browser-versions)

### Installation

1. Install `@adguard/api` module via `npm` or `yarn`
```
npm install @adguard/api
```
or
```
yarn add @adguard/api
```

1. Import `AdguardApi` class to background script
```
import { AdguardApi } from "@adguard/api";
```

1. Import `adguard-contents` in top of you content script entry

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
    filteringEnabled: boolean,
    allowlist?: string[],
    blocklist?: string[],
    rules?: string[],
    filtersMetadataUrl: string,
    filterRulesUrl: string,
    documentBlockingPageUrl?: string,
};
```

**Properties:**

- `filters` (mandatory) - An array of filters identifiers. You can look for possible filters identifiers in the [filters metadata file](https://filters.adtidy.org/extension/chromium/filters.json).

- `filteringEnabled` (mandatory) - Enable/disable filtering engine.

- `allowlist` (optional) - An array of domains, for which AdGuard won't work.

- `blocklist` (optional) - This property completely changes AdGuard behavior. If it is defined, Adguard will work for domains from the `blocklist` only. All other domains will be ignored. If `blocklist` is defined, `allowlist` will be ignored.

- `rules` (optional) - An array of custom filtering rules. Here is an [article](https://adguard.com/en/filterrules.html) describing filtering rules syntax. These custom rules might be created by a user via AdGuard Assistant UI.

- `filtersMetadataUrl` (mandatory) - An absolute path to a file, containing filters metadata. Once started, AdGuard will periodically check filters updates by downloading this file. Example: `https://filters.adtidy.org/extension/chromium/filters.json`.

- `filterRulesUrl` (mandatory) - URL mask used for fetching filters rules. `{filter_id}` parameter will be replaced with an actual filter identifier. Example: `https://filters.adtidy.org/extension/chromium/filters/{filter_id}.txt` (English filter (filter id = 2) will be loaded from: `https://filters.adtidy.org/extension/chromium/2.txt`)
  
- `documentBlockingPageUrl` (optional) - Path to the document blocking page. If not specified, the default browser page will be shown.

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
public static async create(): Promise<AdguardApi>
```

**Example:**
```typescript
const adguardApi = await AdguardApi.create();
```

## Methods

### `adguardApi.getMessageHandler`

Gets message handler for API content script messages.

Api message handler name is a constant that can be exported as `MESSAGE_HANDLER_NAME` from `@adguard/api`.

**Syntax:**
```typescript
public getMessageHandler(): MessageHandlerMV2
```

**Example:**

```typescript
// get tswebextension message handler
const handleApiMessage = adguardApi.getMessageHandler();

const handleAppMessage = async (message: Message) => {
  // handle your app messages here
};

// route message depending on handler name
browser.runtime.onMessage.addListener(async (message, sender) => { 
  if (message?.handlerName === MESSAGE_HANDLER_NAME) {
    return Promise.resolve(handleApiMessage(message, sender));
  }
  return handleAppMessage(message);
});    
```

**Returns:**

Message handler that will listen to internal messages, for example: message for get computed css for content-script.

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

Promise, resolved with applied [API Configuration](#api-configuration) when api config is updated.

### `adguardApi.setFilteringEnabled`

Enables or disables filtering without engine re-initialization.

**Syntax:**
```typescript
public async setFilteringEnabled(value: boolean): Promise<void>
```

**Example:**
```typescript
await adguardApi.setFilteringEnabled(false);
```

**Parameters:**

- `value` - boolean value, which indicates filtering engine state.

**Returns:**

Promise, resolved when filtering engine state is updated.

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
