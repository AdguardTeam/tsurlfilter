# AdGuard API

> [!NOTE]
> Version: **v2.1.0**

AdGuard API is a filtering library that provides the following features:

- Request and content filtering, using
[@adguard/tswebextension][tswebextensionreadme].
- Filtering rules list management (downloading, caching, and auto updates).
- Content blocking via AdGuard Assistant UI.
- Auto-detecting language filters.
- Logging request processing.

[tswebextensionreadme]: ../tswebextension/README.md

## Table of contents

- [AdGuard API](#adguard-api)
  - [Table of content](#table-of-contents)
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

1. Install the `@adguard/api` module via `npm` or `yarn`

  ```shell
  npm install @adguard/api
  ```

  or

  ```shell
  yarn add @adguard/api
  ```

1. Import the `AdguardApi` class to the background script

  ```ts
  import { AdguardApi } from "@adguard/api";
  ```

1. Import `adguard-contents` at the top of your content script entry

  ```ts
  import '@adguard/api/content-script';
  ```

1. Import `adguard-assistant` at the top of your assistant script entry

  ```ts
  import '@adguard/api/assistant';
  ```

### Required web accessible resources

AdGuard API requires [web accessible resources][webaccessibleresources] from the
[AdGuard Scriptlets library][scriptletsredirectres] to be able to redirect web
requests to a local "resource" using the `$redirect` rule modifier. You can use
[@adguard/tswebextension CLI][tswebextensionusage] to download it.

[webaccessibleresources]: https://developer.chrome.com/docs/extensions/mv3/manifest/web_accessible_resources/
[scriptletsredirectres]: https://github.com/AdguardTeam/Scriptlets#redirect-resources
[tswebextensionusage]: ../tswebextension/README.md#usage

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

- `filters` (mandatory) - An array of filters identifiers. You can look for
  possible filters identifiers in the [filters metadata file][filters-metadata].

- `filteringEnabled` (mandatory) - Enable/disable filtering engine.

- `allowlist` (optional) - An array of domains, for which AdGuard won't work.

- `blocklist` (optional) - This property completely changes AdGuard behavior. If
  it is defined, Adguard will work for domains from the `blocklist` only. All
  other domains will be ignored. If `blocklist` is defined, `allowlist` will be
  ignored.

- `rules` (optional) - An array of custom filtering rules. Here is an
  [article][filter-rules] describing filtering rules syntax. These custom rules
  might be created by a user via AdGuard Assistant UI.

- `filtersMetadataUrl` (mandatory) - An absolute path to a file, containing
  filters metadata. Once started, AdGuard will periodically check filters
  updates by downloading this file. Example:
  `https://filters.adtidy.org/extension/chromium/filters.json`.

- `filterRulesUrl` (mandatory) - URL mask used for fetching filters rules.
  `{filter_id}` parameter will be replaced with an actual filter identifier.
  Example: `https://filters.adtidy.org/extension/chromium/filters/{filter_id}.txt`
  (English filter (filter id = 2) will be loaded from:
  `https://filters.adtidy.org/extension/chromium/2.txt`)

- `documentBlockingPageUrl` (optional) - Path to the document blocking page. If
  not specified, the default browser page will be shown.

[filters-metadata]: https://filters.adtidy.org/extension/chromium/filters.json
[filter-rules]: https://adguard.com/en/filterrules.html

**Example:**

```ts
const configuration: Configuration = {
    filters: [],
    allowlist: [],
    blocklist: [],
    rules: [],
    filtersMetadataUrl: 'https://filters.adtidy.org/extension/chromium/filters.json',
    filterRulesUrl: 'https://filters.adtidy.org/extension/chromium/filters/{filter_id}.txt'
};
```

> ![!WARNING]
> **Please note, that we do not allow using `filters.adtidy.org` other than for
> testing purposes**. You have to use your own server for storing filter files.
> You can (and actually should) use `filters.adtidy.org` for periodically
> updating files on your side.

## Static methods

Creates a new `AdguardApi` instance.

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

Gets the message handler for API content script messages.

The API message handler name is a constant that can be exported as
`MESSAGE_HANDLER_NAME` from `@adguard/api`.

**Syntax:**

```ts
public getMessageHandler(): MessageHandlerMV2
```

**Example:**

```ts
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

A message handler that will listen to internal messages. For example: messages
for get computed css for content-script.

### `adguardApi.start`

Initializes AdGuard API and starts it immediately.

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

A Promise, resolved with applied [API Configuration](#api-configuration) when api is initialized and filtering started

### `adguardApi.stop`

Completely stops AdGuard API.

**Syntax:**

```ts
public async stop(): Promise<void>
```

**Example:**

```ts
await adguardApi.stop();
```

**Returns:**

Promise, resolved when API is completely stopped

### `adguardApi.configure`

This method modifies AdGuard configuration.

> Note, that Adguard must be already started (see [adguardApi.start](#adguardapistart)).

**Syntax:**

```ts
public async configure(configuration: Configuration): Promise<Configuration>
```

**Example:**

```ts
const updatedConfiguration = await adguardApi.configure(configuration);
```

**Parameters:**

- `configuration` - [API Configuration](#configuration)

**Returns:**

A `Promise` object that is getting resolved with applied
[API Configuration](#configuration) when the API config is updated.

### `adguardApi.setFilteringEnabled`

Enables or disables filtering without engine re-initialization.

**Syntax:**

```ts
public async setFilteringEnabled(value: boolean): Promise<void>
```

**Example:**

```ts
await adguardApi.setFilteringEnabled(false);
```

**Parameters:**

- `value` - boolean value that indicates the filtering engine state.

**Returns:**

A `Promise` object that is getting resolved when filtering engine state is
updated.

### `adguardApi.openAssistant`

Opens the AdGuard Assistant UI in the specified tab. You must also subscribe
on [onAssistantCreateRule](#adguardapionassistantcreaterule) event channel for
applying rules that are created by Adguard Assistant.

**Syntax:**

```ts
public async openAssistant(tabId: number): Promise<void>
```

**Example:**

```ts
await adguardApi.openAssistant(tabId);
```

**Parameters:**

- `tabId` - `chrome.tabs.Tab` id, see: <https://developer.chrome.com/docs/extensions/reference/tabs/#type-Tab>

**Returns:**

A `Promise` object that is getting resolved when the Assistant UI is opened in
the specified tab.

### `adguardApi.closeAssistant`

Closes AdGuard Assistant in the specified tab.

**Syntax:**

```ts
public async openAssistant(tabId: number): Promise<void>
```

**Example:**

```ts
await adguardApi.closeAssistant(tabId);
```

**Parameters:**

- `tabId` - `chrome.tabs.Tab` id, see: <https://developer.chrome.com/docs/extensions/reference/tabs/#type-Tab>

**Returns:**

A `Promise` object that is getting resolved when Assistant UI id closed in the
specified tab.

### `adguardApi.getRulesCount`

Gets currently loaded rules count.

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

`TsWebExtension` event channel that receives events when a rule is created
via AdGuard Assistant.

**Syntax:**

```ts
public onAssistantCreateRule: EventChannel<string>;
```

**Example:**

```ts

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
- `requestUrl` - URL of the blocked request.
- `referrerUrl` - Referrer URL.
- `rule` - Filtering rule that has been applied to this request.
- `filterId` - ID of the filter list the rule belongs to.
- `requestType` - Request mime type. Possible values are listed below:

> Request types:
>
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

```ts
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

| Browser                  | Version   |
|------------------------- |:---------:|
| Chromium Based Browsers  |  79       |
| Firefox                  |  78       |
| Opera                    |  66       |
| Edge                     |  79       |
