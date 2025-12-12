# AdGuard API MV3

AdGuard API is a filtering library that provides the following features:

- Request and content filtering, using
[@adguard/tswebextension][tswebextensionreadme].
- Content blocking via AdGuard Assistant UI.

[tswebextensionreadme]: https://github.com/AdguardTeam/tsurlfilter/blob/master/packages/tswebextension/README.md

## Table of contents

- [Installation](#installation)
- [Required web accessible resources](#required-web-accessible-resources)
- [Required declarativeNetRequest API assets](#required-declarativenetrequest-api-assets)
- [Configuration](#configuration)
- [Local Script Rules for MV3](#local-script-rules-for-mv3)
- [Excluding Unsafe Rules for Chrome Web Store "Skip Review"](#excluding-unsafe-rules-for-chrome-web-store-skip-review)
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
    - [`adguardApi.onRequestBlocked`](#adguardapionrequestblocked)
- [Usage](#usage)
- [Minimum supported browser versions](#minimum-supported-browser-versions)
- [Development](#development)
    - [Install dependencies](#install-dependencies)
    - [Build](#build)
    - [Lint](#lint)

## Installation

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

## Required web accessible resources

AdGuard API MV3 requires [web accessible resources][webaccessibleresources] from the
[AdGuard Scriptlets library][scriptletsredirectres] to be able to redirect web
requests to a local "resource" using the `$redirect` rule modifier. You can use
[@adguard/tswebextension CLI][tswebextensionusage] to download it.

[webaccessibleresources]: https://developer.chrome.com/docs/extensions/mv3/manifest/web_accessible_resources/
[scriptletsredirectres]: https://github.com/AdguardTeam/Scriptlets#redirect-resources
[tswebextensionusage]: https://github.com/AdguardTeam/tsurlfilter/blob/master/packages/tswebextension/README.md#cli

## Required declarativeNetRequest API assets

**IMPORTANT: To correct work of `$redirect` path should be `/web-accessible-resources/redirects`.**
<br>
If you are using `@adguard/dnr-rulesets` package, path to web accessible resources is
built-in into converted rules with `$redirect` modifier and packed inside rulesets.

<br>
Because it should used via periodically updating from the remote in the runtime
and passed as part of dynamic rules - `Configuration.rules`.

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
    documentBlockingPageUrl?: string | undefined;
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

- `documentBlockingPageUrl` (optional) - Redirect URL for blocking rules with
  `$document` modifier. If not specified, default browser page will be shown.
  Page will receive following query parameters:
  - `url` - blocked URL
  - `rule` - blocking rule that triggered on this URL
  - `filterId` - ID of the filter that contains this rule (0 for user rules)

  Example: `chrome-extension://<extension_id>/blocking-page.html?url=https%3A%2F%2Fexample.net%2F&rule=example.net%24document&filterId=0`

[filter-rules]: https://kb.adguard.com/en/general/how-to-create-your-own-ad-filters

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

## Local Script Rules for MV3

In Manifest V3 extensions, JavaScript injection rules have strict security restrictions
due to Chrome Web Store policies regarding remote code execution. The API enforces a
required validation mechanism to ensure all script rules are pre-verified.

### How it works

**When local_script_rules.js IS provided (Recommended):**

- All JS script rules are pre-verified and bundled into the extension during the build process.
- At runtime, only script rules that match entries in `local_script_rules.js` are executed.
- All other scripts are discarded to prevent remote code execution.
- This ensures perfect compliance with Chrome Web Store policies.

**When local_script_rules.js is NOT provided:**

- All script rules (except scriptlets) will be **blocked** for security compliance.
- The extension will not execute any custom JS rules to prevent potential remote code execution.
- **It is highly recommended to always provide `local_script_rules.js`** during your build process.

**With UserScripts API permission enabled:**

- Custom JS rules can be executed directly via the browser's userScripts API, which provides secure sandboxing.
- This requires explicit user activation via extension settings.

### Why it's critical for MV3

Providing `local_script_rules.js` is **essential** for MV3 extensions because:

1. Chrome Web Store strictly forbids remote code execution in extensions.
2. Pre-verification ensures only safe, approved scripts can execute.
3. Failure to provide it results in all script rules being blocked.
4. This prevents Chrome Web Store rejection due to potential policy violations.

### Extending `local_script_rules.js`

You can extend `local_script_rules.js` with custom rules during your extension's build process.
This allows you to pre-approve specific custom scriptlets or JS injection rules before runtime.

**Example implementation:**

See the MV3 example extension for a complete implementation:

- **Extra scripts definition**: [`packages/examples/adguard-api-mv3/extension/src/extra-scripts.ts`](https://github.com/AdguardTeam/tsurlfilter/blob/master/packages/examples/adguard-api-mv3/extension/src/extra-scripts.ts)
- **Build script usage**: [`packages/examples/adguard-api-mv3/scripts/build/build.ts`](https://github.com/AdguardTeam/tsurlfilter/blob/master/packages/examples/adguard-api-mv3/scripts/build/build.ts)

The build script uses the `AssetsLoader.extendLocalScriptRulesJs()` method to add
extra pre-verified rules to `local_script_rules.js`:

```typescript
import { AssetsLoader, LOCAL_SCRIPT_RULES_JS_FILENAME } from '@adguard/dnr-rulesets';
import { extraScripts } from './extra-scripts';

const loader = new AssetsLoader();
await loader.extendLocalScriptRulesJs(
    path.join('./extension/filters', LOCAL_SCRIPT_RULES_JS_FILENAME),
    extraScripts
);
```

## Excluding Unsafe Rules for Chrome Web Store "Skip Review"

Chrome Web Store provides a ["skip review" option](https://developer.chrome.com/docs/webstore/skip-review) for extensions that only use "safe" declarativeNetRequest rules. This allows your extension updates to be published instantly without manual review, significantly reducing update deployment time.

### What are safe rules?

According to Chrome's policy, only declarative rules with the following action types are considered "safe":
- `block` - blocks network requests
- `allow` - allows network requests
- `allowAllRequests` - allows all requests from a domain
- `upgradeScheme` - upgrades HTTP to HTTPS

Rules with other action types (such as `redirect`, `modifyHeaders`, `removeHeaders`) are considered "unsafe" and require manual review.

### Why exclude unsafe rules?

To qualify for the "skip review" option in Chrome Web Store:
1. Your extension must only contain safe declarative rules
2. Unsafe rules must be excluded from your rulesets during the build process
3. This allows faster extension updates and reduces review queue time

### How to exclude unsafe rules in your build process

The `@adguard/dnr-rulesets` package provides the `excludeUnsafeRules` function that:
- Scans all rulesets in your filters directory
- Identifies and removes unsafe rules
- Stores unsafe rules in metadata for reference
- Updates ruleset checksums automatically
- AdGuard API will extract unsafe rules automatically and apply them via `sessionRules`

#### CLI Usage

Add this command to your build process after loading DNR rulesets:

```bash
dnr-rulesets exclude-unsafe-rules ./extension/filters/declarative [options]
```

**Options:**
- `--prettify-json` (default: `true`) - Prettify JSON output
- `--limit <number>` - Maximum number of unsafe rules allowed. Build fails if exceeded.

**Example in package.json:**

```json
{
  "scripts": {
    "load-dnr-rulesets": "dnr-rulesets load ./extension/filters",
    "patch-manifest": "dnr-rulesets manifest ./extension/manifest.json ./extension/filters",
    "exclude-unsafe-rules": "dnr-rulesets exclude-unsafe-rules ./extension/filters/declarative --limit 4900",
    "build": "npm run load-dnr-rulesets && npm run patch-manifest && npm run exclude-unsafe-rules"
  }
}
```

`4900` is selected intentionally since limit for `sessionRules` is `5000`.

#### Programmatic API Usage

You can also integrate `excludeUnsafeRules` into your build scripts:

```typescript
import { excludeUnsafeRules } from '@adguard/dnr-rulesets';

async function build() {
    // Load DNR rulesets and patch manifest first
    // ... your existing build code ...

    // Exclude unsafe rules for CWS "skip review"
    await excludeUnsafeRules({
        dir: './extension/filters/declarative',
        prettifyJson: false,  // optional: minimize JSON file size
        limit: 4900,          // optional: fail build if too many unsafe rules
    });

    console.log('Unsafe rules excluded. Extension is ready for CWS skip review.');
}
```

**Complete build script example:**

```typescript
import { AssetsLoader, ManifestPatcher, excludeUnsafeRules } from '@adguard/dnr-rulesets';

async function build() {
    // 1. Load DNR rulesets
    const loader = new AssetsLoader();
    await loader.load('./extension/filters');

    // 2. Patch manifest with rulesets
    const patcher = new ManifestPatcher();
    patcher.patch('./extension/manifest.json', './extension/filters', {
        forceUpdate: true,
        ids: ['2', '3'], // your filter IDs
    });

    // 3. Exclude unsafe rules for CWS "skip review"
    await excludeUnsafeRules({
        dir: './extension/filters/declarative',
        prettifyJson: false,
        limit: 4900,
    });

    // 4. Continue with your webpack/build process...
}
```

### Important Notes

- **Call order matters**: Always run `excludeUnsafeRules` **after** loading rulesets and patching manifest. Prevent double call of `excludeUnsafeRules` in your build process since
it will override unsafe rules from first call and all unsafe rules will be just
deleted from rulesets.

For a complete working example, see the [example extension build script](../examples/adguard-api-mv3/scripts/build/build.ts).

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

### `adguardApi.onRequestBlocked`

API for adding and removing listeners for request blocking events.

> [!NOTE]
> You must have the `webRequest` permission in your manifest to use.

> [!NOTE]
> Rule calculated by tsurlfilter is not always the same as the declarative rule that has blocked the request.
> That's why we provide an `assumedRule` and `assumedFilterId` properties in the event object.
> We will improve the rule calculation algorithm to provide more accurate results in future releases.

**Syntax:**

```typescript
export interface RequestBlockingLoggerInterface {
    addListener(listener: EventChannelListener<RequestBlockingEvent>): void;
    removeListener(listener: EventChannelListener<RequestBlockingEvent>): void;
}
```

**Callback parameter properties:**

```typescript
type RequestBlockingEvent = {
    /**
     * Tab identifier.
     */
    tabId: number;

    /**
     * Blocked request id.
     */
    requestId: string;

    /**
     * Blocked request URL.
     */
    requestUrl: string;

    /**
     * Referrer URL.
     */
    referrerUrl: string;

    /**
     * Request mime type
     */
    requestType: ContentType;

    /**
     * Assumed Filtering rule index, which has blocked this request. May not be provided if request is blocked by DNR rule.
     */
    assumedRuleIndex?: number;

    /**
     * Assumed rule's filter identifier. May not be provided if request is blocked by DNR rule.
     */
    assumedFilterId?: number;

    /**
     * Company category name for requests blocked by DNR rule. Provided only if request is blocked by DNR rule.
     */
    companyCategoryName?: string;
};
```

Learn more about `companyCategoryName` in the [list of company categories].

> Note that few events can be fired for the same request, e.g., when a request is blocked by a DNR rule,
> first event is fired during `onBeforeRequest` with `assumedRuleIndex` and `assumedFilterId` properties
> but no `companyCategoryName` is provided,
> and the second event is fired during `onErrorOccurred` with `companyCategoryName` property defined
> but `assumedRuleIndex` and `assumedFilterId` are `-1`.
> So you can handle such requests by the `requestId` property.

[list of company categories]: https://github.com/AdguardTeam/companiesdb/blob/main/README.md#tracker-categories

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

> Supported Request types:
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

    // console log event on request blocking
    const onRequestBlocked = (event: RequestBlockingEvent) => {
        console.log(event);
    };

    adguardApi.onRequestBlocked.addListener(onRequestBlocked);

    let configuration: Configuration = {
        /**
         * filters identifiers from dnr-rulesets
         * @see https://filters.adtidy.org/extension/chromium/filters.json
         */
        filters: [2, 3, 4],
        filteringEnabled: true,
        allowlist: ['www.example.com'],
        rules: ['example.org##h1'],
        assetsPath: 'filters',
    };

    // console log current rules count, loaded in engine
    const logTotalCount = (): void => {
        console.log('Total rules count:', adguardApi.getRulesCount());
    };

    try {
        configuration = await adguardApi.start(configuration);
        console.log('Finished Adguard API initialization.');
        console.log('Applied configuration: ', JSON.stringify(configuration));
        logTotalCount();
    } catch (error) {
        console.error('Failed to start AdGuard API:', error);
        return;
    }

    configuration.allowlist!.push('www.google.com');

    try {
        await adguardApi.configure(configuration);
        console.log('Finished Adguard API re-configuration');
        logTotalCount();
    } catch (error) {
        console.error('Failed to configure AdGuard API:', error);
    }

    const onAssistantCreateRule = async (rule: string) => {
        // update config on assistant rule apply
        console.log(`Rule ${rule} was created by Adguard Assistant`);
        configuration.rules!.push(rule);
        try {
            await adguardApi.configure(configuration);
            console.log('Finished Adguard API re-configuration');
            logTotalCount();
        } catch (error) {
            console.error('Failed to apply assistant rule:', error);
        }
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
        adguardApi.onRequestBlocked.removeListener(onRequestBlocked);
        adguardApi.onAssistantCreateRule.unsubscribe(onAssistantCreateRule);
        await adguardApi.stop();
        console.log('Adguard API MV3 has been disabled.');
    }, 60 * 1000);
})();
```

<!-- TODO: check minimum supported version later -->
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
