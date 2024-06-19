# AdGuard API MV3

> [!NOTE]
> Version: **v0.0.1**

AdGuard API is a filtering library that provides the following features:

- Request and content filtering, using
[@adguard/tswebextension][tswebextensionreadme].
- Content blocking via AdGuard Assistant UI.

[tswebextensionreadme]: https://github.com/AdguardTeam/tsurlfilter/blob/master/packages/tswebextension/README.md

## Table of contents

- [AdGuard API MV3](#adguard-api-mv3)
  - [Table of contents](#table-of-contents)
    - [Installation](#installation)
    - [Required web accessible resources](#required-web-accessible-resources)
    - [Required declarativeNetRequest API assets](#required-declarativenetrequest-api-assets)
  - [Configuration](#configuration)
  - [Static methods](#static-methods)
    - [`AdguardApi.create`](#adguardapicreate)
  - [Methods](#methods)
    - [`adguardApi.getMessageHandler`](#adguardapigetmessagehandler)
    - [`adguardApi.start`](#adguardapistart)
    - [`adguardApi.stop`](#adguardapistop)
    - [`adguardApi.configure`](#adguardapiconfigure)
    - [`adguardApi.openAssistant`](#adguardapiopenassistant)
    - [`adguardApi.closeAssistant`](#adguardapicloseassistant)
    - [`adguardApi.getRulesCount`](#adguardapigetrulescount)
    - [`adguardApi.onAssistantCreateRule`](#adguardapionassistantcreaterule)
  - [Coming soon](#coming-soon)
    - [`adguardApi.onRequestBlocking`](#adguardapionrequestblocking)
  - [Usage](#usage)
  - [Minimum supported browser versions](#minimum-supported-browser-versions)
  - [Development](#development)
    - [Install dependencies](#install-dependencies)
    - [Build](#build)
    - [Lint](#lint)

### Installation

1. Install the `@adguard/api-mv3` module via `npm` or `yarn`

  ```shell
  npm install @adguard/api-mv3
  ```

  or

  ```shell
  yarn add @adguard/api-mv3
  ```

1. Import the `AdguardApi` class to the background script

  ```ts
  import { AdguardApi } from "@adguard/api-mv3";
  ```

1. Import `adguard-contents` at the top of your content script entry

  ```ts
  import '@adguard/api-mv3/content-script';
  ```

1. Import `adguard-assistant` at the top of your assistant script entry

  ```ts
  import '@adguard/api-mv3/assistant';
  ```

### Required web accessible resources

AdGuard API MV3 requires [web accessible resources][webaccessibleresources] from the
[AdGuard Scriptlets library][scriptletsredirectres] to be able to redirect web
requests to a local "resource" using the `$redirect` rule modifier. You can use
[@adguard/tswebextension CLI][tswebextensionusage] to download it.

[webaccessibleresources]: https://developer.chrome.com/docs/extensions/mv3/manifest/web_accessible_resources/
[scriptletsredirectres]: https://github.com/AdguardTeam/Scriptlets#redirect-resources
[tswebextensionusage]: https://github.com/AdguardTeam/tsurlfilter/blob/master/packages/tswebextension/README.md#cli

### Required declarativeNetRequest API assets

AdGuard API MV3 requires prebuilt DNR rule sets to be able to filter web requests. You can use
[@adguard/dnr-rulesets CLI](../dnr-rulesets/README.md) to download it. We also provide a extension example with scripts for loading DNR rulesets and patching manifest in the [examples/adguard-api-mv3](../examples/adguard-api-mv3/) directory.

## Configuration

**Syntax:**

```typescript
type Configuration = {
    filters: number[];
    filteringEnabled: boolean;
    assetsPath: string;
    allowlist?: string[] | undefined;
    blocklist?: string[] | undefined;
    rules?: string[] | undefined;
};
```

**Properties:**

- `filters` (mandatory) - An array of filters identifiers. You can look for
  possible filters identifiers in [dnr-rulesets](../dnr-rulesets/README.md#included-filter-lists).

- `filteringEnabled` (mandatory) - Enable/disable filtering engine.

- `assetsPath` (mandatory) - Path to the directory with DNR rule sets. You can
  use the [dnr-rulesets](../dnr-rulesets/README.md) CLI to download DNR rule sets.

- `allowlist` (optional) - An array of domains, for which AdGuard won't work.

- `blocklist` (optional) - This property completely changes AdGuard behavior. If
  it is defined, Adguard will work for domains from the `blocklist` only. All
  other domains will be ignored. If `blocklist` is defined, `allowlist` will be
  ignored.

- `rules` (optional) - An array of custom filtering rules. Here is an
  [article][filter-rules] describing filtering rules syntax. These custom rules
  might be created by a user via AdGuard Assistant UI.

**Example:**

```ts
const configuration: Configuration = {
    // Filters identifiers defined in @adguard/dnr-rulesets
    filters: [1, 2, 3, 4, 9, 14],
    filteringEnabled: true,
    assetsPath: 'filters',
    allowlist: ['www.example.com'],
    rules: ['example.org##h1'],
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
`MESSAGE_HANDLER_NAME` from `@adguard/api-mv3`.

The list of possible message types is defined in [tswebextension](../tswebextension/src/lib/common/message.ts)

**Syntax:**

```ts
public getMessageHandler(): MessageHandlerMV3
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

## Coming soon

Some APIs are not implemented yet, we publish them in the next releases.

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

See full sample app project in [examples/adguard-api](../examples/adguard-api-mv3)

```ts
import browser from 'webextension-polyfill';
import { AdguardApi, type Configuration, MESSAGE_HANDLER_NAME } from '@adguard/api-mv3';

(async (): Promise<void> => {
    // create new AdguardApi instance
    const adguardApi = await AdguardApi.create();

    let configuration: Configuration = {
        /**
         * filters identifiers from dnr-rulesets
         * @see https://filters.adtidy.org/extension/chromium/filters.json
         */
        filters: [1, 2, 3, 4, 9, 14],
        filteringEnabled: true,
        allowlist: ['www.example.com'],
        rules: ['example.org##h1'],
        assetsPath: 'filters',
    };

    // console log current rules count, loaded in engine
    const logTotalCount = (): void => {
        console.log('Total rules count:', adguardApi.getRulesCount());
    };

    configuration = await adguardApi.start(configuration);

    console.log('Finished Adguard API initialization.');
    console.log('Applied configuration: ', JSON.stringify(configuration));
    logTotalCount();

    configuration.allowlist!.push('www.google.com');

    await adguardApi.configure(configuration);

    console.log('Finished Adguard API re-configuration');
    logTotalCount();

    const onAssistantCreateRule = async (rule: string) => {
        // update config on assistant rule apply
        console.log(`Rule ${rule} was created by Adguard Assistant`);
        configuration.rules!.push(rule);
        await adguardApi.configure(configuration);
        console.log('Finished Adguard API re-configuration');
        logTotalCount();
    };

    adguardApi.onAssistantCreateRule.subscribe(onAssistantCreateRule);

    // get tswebextension message handler
    const handleApiMessage = adguardApi.getMessageHandler();

    // define custom message handler
    const handleAppMessage = async (message: any) => {
        switch (message.type) {
            case 'OPEN_ASSISTANT': {
                const active = await browser.tabs.query({ active: true });
                if (active[0]?.id) {
                    await adguardApi.openAssistant(active[0].id);
                }
                break;
            }
            default:
            // do nothing
        }
    };

    browser.runtime.onMessage.addListener(async (message, sender) => {
        // route message depending on handler name
        if (message?.handlerName === MESSAGE_HANDLER_NAME) {
            return Promise.resolve(handleApiMessage(message, sender));
        }
        return handleAppMessage(message);
    });

    // Disable Adguard in 1 minute
    setTimeout(async () => {
        adguardApi.onAssistantCreateRule.unsubscribe(onAssistantCreateRule);
        await adguardApi.stop();
        console.log('Adguard API has been disabled.');
    }, 60 * 1000);
})();
```

## Minimum supported browser versions

| Browser                 | Version |
| ----------------------- | :-----: |
| Chromium Based Browsers |   84    |


## Development

### Install dependencies

```shell
pnpm install
```

### Build

```shell
npx lerna run build --scope @adguard/api-mv3 --include-dependencies
```

### Lint

```shell
pnpm run lint
```
