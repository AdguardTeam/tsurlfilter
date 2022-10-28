# AdGuard API
**Document version: 1.0**

AdGuard API is filtering library, provided following features:

- request and content filtering, using [@adguard/tswebextension](../tswebextension/README.md)
- filtering rules list management (downloading, caching and auto updates)
- content blocking via AdGuard Assistant UI 
- auto detecting language filters
- logging request processing

## Table of content
  - [Installation](#installation)
    - [Installation via `script` tag](#installation-via-script-tag)
    - [Installation via `npm`](#installation-via-npm)
  - [Configuration](#configuration)
  - [Methods](#methods)
    - [`adguardApi.start`](#adguardapistart)
    - [`adguardApi.stop`](#adguardapistop)
    - [`adguardApi.configure`](#adguardapiconfigure)
    - [`adguardApi.openAssistant`](#adguardapiopenassistant)
    - [`adguardApi.closeAssistant`](#adguardapicloseassistant)
    - [`adguardApi.getRulesCount`](#adguardapigetrulescount)
  - [Event Channels](#event-channels)
    - [`adguardApi.onFilteringLogEvent`](#adguardapionfilteringlogevent)
    - [`adguardApi.onAssistantCreateRule`](#adguardapionassistantcreaterule)
  - [Usage](#usage)

The library code can be loaded either via `script` tag or as an `npm` module.
### Installation via `script` tag

1. Copy `adguard-api.js` and `adguard-content.js` scripts from `dist` to the directory near `manifest.json`

2. Create `adguard` directory near `manifest.json`

3. Place web accessible resources into `adguard` directory

> Note: you can use [@adguard/tswebextenison CLI](../tswebextension/README.md#cli-api) for downloading resources

4. Add AdGuard's content script to the manifest:
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

AdGuard API is exposed through a global javascript object: `adguardApi`.

### Installation via `npm`

The preferred installation method for applications built using bundlers, such as webpack or rollup

1. Install `@adguard/api` module
```
npm install @adguard/api
```
or
```
yarn add @adguard/api
```

2. Import `adguardApi` instance to background script
```
import { adguardApi } from "@adguard/api";
```

3. Import `adguard-contents` in top of you content script entry

```
import '@adguard/api/content-script';
```

4. Add web accessible resources downloading in you build pipeline or load it manually

> Note: you can use [@adguard/tswebextenison CLI](../tswebextension/README.md#usage) for downloading resources

5. Setup manifest content-script with imported `adguard-contents` as follow

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

## Configuration

**Syntax:**
```typescript
type Configuration = {
    filters: number[],
    whitelist?: string[],
    blacklist?: string[],
    rules?: string[],
    filtersMetadataUrl: string,
    filterRulesUrl: string,
};
```

**Properties:**

- `filters` (mandatory) - An array of filters identifiers. You can look for possible filters identifiers in the [filters metadata file](https://filters.adtidy.org/extension/chromium/filters.json).

- `whitelist` (optional) - An array of domains, for which AdGuard won't work.

- `blacklist` (optional) - This property completely changes AdGuard behavior. If it is defined, Adguard will work for domains from the `blacklist` only. All other domains will be ignored. If `blacklist` is defined, `whitelist` will be ignored.

- `rules` (optional) - An array of custom filtering rules. Here is an [article](https://adguard.com/en/filterrules.html) describing filtering rules syntax. These custom rules might be created by a user via AdGuard Assistant UI.

- `filtersMetadataUrl` (mandatory) - An absolute path to a file, containing filters metadata. Once started, AdGuard will periodically check filters updates by downloading this file. Example: `https://filters.adtidy.org/extension/chromium/filters.json`.

- `filterRulesUrl` (mandatory) - URL mask used for fetching filters rules. `{filter_id}` parameter will be replaced with an actual filter identifier. Example: `https://filters.adtidy.org/extension/chromium/filters/{filter_id}.txt` (English filter (filter id = 2) will be loaded from: `https://filters.adtidy.org/extension/chromium/2.txt`)

**Example:**
```typescript

const configuration: Configuration = {
    filters: [],
    whitelist: [],
    blacklist: [],
    rules: [],
    filtersMetadataUrl: 'https://filters.adtidy.org/extension/chromium/filters.json',
    filterRulesUrl: 'https://filters.adtidy.org/extension/chromium/filters/{filter_id}.txt'
};
```

> **Please note, that we do not allow using `filters.adtidy.org` other than for testing purposes**. You have to use your own server for storing filters files. You can (and actually should) to use `filters.adtidy.org` for updating files on your side periodically.


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

Opens the AdGuard assistant UI in the specified tab. You should also subscribe on [onAssistantCreateRule](#adguardapionassistantcreaterule) event channel for applying rules, which are created by the Adguard assistant.

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

Promise, resolved when assistant UI is opened in specified tab

### `adguardApi.closeAssistant`

Closes AdGuard assistant in the specified tab.

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

Promise, resolved when assistant UI id closed in specified tab

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

## Event Channels

`adguardApi` also provided access to some useful [tswebextension](../tswebextension/README.md) event channels

### `adguardApi.onFilteringLogEvent`

TsWebExtension Event channel for filtering log events.

**Syntax:**

```typescript
public onFilteringLogEvent: EventChannel<FilteringLogEvent>;
```

**Example:**

```typescript
// console log request data on basic rule apply
const onFilteringLogEvent = (event: FilteringLogEvent) => {
  if (event.type === FilteringEventType.APPLY_BASIC_RULE) {
    console.log(event.data);
  }
};

adguardApi.onFilteringLogEvent.subscribe(onFilteringLogEvent);
```

### `adguardApi.onAssistantCreateRule`

TsWebExtension Event channel, which fires event on assistant rule creation.

**Syntax:**

```typescript
public onAssistantCreateRule: EventChannel<string>;
```

**Example:**

```typescript
// update config on assistant rule apply
adguardApi.onAssistantCreateRule.subscribe(async (rule) => {
  console.log(`Rule ${rule} was created by Adguard Assistant`);
  configuration.rules!.push(rule);
  await adguardApi.configure(configuration);
});
```
## Usage

See full sample app project in [examples/adguard-api](../examples/adguard-api/)

```typescript
import { adguardApi, Configuration, FilteringLogEvent, FilteringEventType } from "@adguard/api";

(async (): Promise<void> => {
    const configuration: Configuration = {
        filters: [2],
        whitelist: ["www.avira.com"],
        rules: ["example.org##h1"],
        filterRulesUrl: "https://filters.adtidy.org/extension/chromium/filters/{filter_id}.txt",
        filtersMetadataUrl: "https://filters.adtidy.org/extension/chromium/filters.json",
    };

    // console log request data on basic rule apply
    const onFilteringLogEvent = (event: FilteringLogEvent) => {
        if (event.type === FilteringEventType.APPLY_BASIC_RULE) {
            console.log(event.data);
        }
    };

    // console log current rules count, loaded in engine
    const logTotalCount = (): void => {
        console.log("Total rules count:", adguardApi.getRulesCount());
    };

    adguardApi.onFilteringLogEvent.subscribe(onFilteringLogEvent);

    await adguardApi.start(configuration);

    console.log("Finished Adguard API initialization.");
    logTotalCount();

    configuration.whitelist!.push("www.google.com");

    await adguardApi.configure(configuration);

    console.log("Finished Adguard API re-configuration");
    logTotalCount();

    // update config on assistant rule apply
    adguardApi.onAssistantCreateRule.subscribe(async (rule) => {
        console.log(`Rule ${rule} was created by Adguard Assistant`);
        configuration.rules!.push(rule);
        await adguardApi.configure(configuration);
        console.log("Finished Adguard API re-configuration");
        logTotalCount();
    });

    // listen popup "OPEN_ASSISTANT" message
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
        adguardApi.onFilteringLogEvent.unsubscribe(onFilteringLogEvent);
        await adguardApi.stop();
        console.log("Adguard API has been disabled.");
    }, 60 * 1000);
})();
```
