<!-- omit in toc -->
# TSUrlFilter

[![npm-badge]][npm-url] [![license-badge]][license-url]

[npm-badge]: https://img.shields.io/npm/v/@adguard/tsurlfilter
[npm-url]: https://www.npmjs.com/package/@adguard/tsurlfilter
[license-badge]: https://img.shields.io/npm/l/@adguard/tsurlfilter
[license-url]: https://github.com/AdguardTeam/tsurlfilter/blob/master/packages/tsurlfilter/LICENSE

This is a TypeScript library that implements AdGuard's content blocking rules.

- [Idea](#idea)
- [Installation](#installation)
- [API description](#api-description)
    - [Public properties](#public-properties)
        - [`TSURLFILTER_VERSION`](#tsurlfilter_version)
    - [Public classes](#public-classes)
        - [Engine](#engine)
            - [**Factory**](#factory)
                - [**Sync mode**](#sync-mode)
                - [**Async mode**](#async-mode)
                - [Example](#example)
            - [**matchRequest**](#matchrequest)
            - [**matchFrame**](#matchframe)
            - [Starting engine](#starting-engine)
            - [Matching requests](#matching-requests)
            - [Retrieving cosmetic data](#retrieving-cosmetic-data)
        - [MatchingResult](#matchingresult)
            - [**getBasicResult**](#getbasicresult)
            - [**getDocumentBlockingResult**](#getdocumentblockingresult)
            - [**getCosmeticOption**](#getcosmeticoption)
            - [**Other rules**](#other-rules)
        - [CosmeticResult](#cosmeticresult)
            - [Applying cosmetic result - CSS](#applying-cosmetic-result---css)
            - [Applying cosmetic result - scripts](#applying-cosmetic-result---scripts)
        - [DnsEngine](#dnsengine)
            - [**Constructor**](#constructor)
            - [**match**](#match)
            - [Matching hostname](#matching-hostname)
        - [RuleSyntaxUtils](#rulesyntaxutils)
            - [Public methods](#public-methods)
        - [FilterList](#filterlist)
            - [Key Features](#key-features)
            - [Constructor](#constructor-1)
            - [Conversion Data Structure](#conversion-data-structure)
            - [Main Methods](#main-methods)
                - [Getting Converted Content](#getting-converted-content)
                - [Getting Rule Text](#getting-rule-text)
                - [Getting Original Rule Text](#getting-original-rule-text)
                - [Getting Converted Rule Original (Strict)](#getting-converted-rule-original-strict)
                - [Restoring Original Content](#restoring-original-content)
            - [Static Methods](#static-methods)
            - [Usage Example](#usage-example)
- [Documentation](#documentation)

## <a id="idea"></a>Idea

The idea is to have a single library that we can reuse for the following tasks:

- Doing content blocking in our Chrome and Firefox extensions (obviously)
- Using this library for parsing rules and converting to Safari-compatible
  content blocking lists
  (see [AdGuard for Safari](https://github.com/AdguardTeam/AdguardForSafari),
  [AdGuard for iOS](https://github.com/AdguardTeam/AdguardForiOS))
- Using this library for validating and linting filter lists
  (see [FiltersRegistry](https://github.com/AdguardTeam/FiltersRegistry),
  [AdguardFilters](https://github.com/AdguardTeam/AdguardFilters))

## <a id="usage"></a>Installation

You can install the package via:

- [Yarn][yarn-pkg-manager-url]: `yarn add @adguard/tsurlfilter`
- [NPM][npm-pkg-manager-url]: `npm install @adguard/tsurlfilter`
- [PNPM][pnpm-pkg-manager-url]: `pnpm install @adguard/tsurlfilter`

[npm-pkg-manager-url]: https://www.npmjs.com/get-npm
[yarn-pkg-manager-url]: https://yarnpkg.com/en/docs/install
[pnpm-pkg-manager-url]: https://pnpm.io/

## <a id="api-description"></a>API description

### <a id="public-properties"></a>Public properties

#### <a id="tsurlfilter-version"></a>`TSURLFILTER_VERSION`

type: `string`

Version of the library.

### <a id="public-classes"></a>Public classes

#### <a id="engine"></a>Engine

Engine is a main class of this library. It represents the filtering functionality for loaded rules

##### **Factory**

You can create engine via factories. There are two modes: sync and async.

**Important**: The `content` field in `EngineFactoryOptions` accepts either
a raw string or a `FilterList` instance.
If you provide a string, it will be automatically wrapped
in a `FilterList` and converted.
If you provide a `FilterList` instance, you have full control
over the conversion process by optionally providing conversion data
to the `FilterList` constructor.

**Note**: `tsurlfilter` only supports AdGuard filter syntax.
If you need to convert rules from other syntaxes
(e.g., uBlock Origin, Adblock Plus), use the `FilterList` class
which automatically converts rules to AdGuard format
via `RawRuleConverter.convertToAdg()`.
This conversion should be done at the filter list level
before the engine processes the rules.

###### **Sync mode**

Create engine synchronously.

```ts
/**
 * Creates an instance of the network engine in sync mode.
 *
 * @param options Engine factory options.
 *
 * @returns An instance of the network engine.
 */
public static createSync(options: EngineFactoryOptions): Engine;
```

###### **Async mode**

Create engine asynchronously. We use this approach in AdGuard browser extension to avoid UI lags.

```ts
/**
 * Creates an instance of the network engine in async mode.
 *
 * @param options Engine factory options.
 *
 * @returns An instance of the network engine.
 */
public static createAsync(options: EngineFactoryOptions): Promise<Engine>;
```

###### Example

```ts
const engine = await Engine.createAsync({
    filters: [
        {
            id: 1,
            content: '||example.com^',
        },
    ],
});
```

##### **matchRequest**

```ts
/**
 * Matches the specified request against the filtering engine and returns the matching result.
 * In case frameRules parameter is not specified, frame rules will be selected matching request.sourceUrl.
 *
 * @param request - request to check
 * @param frameRules - source rules or undefined
 * @returns matching result
 */
matchRequest(request: Request, frameRule: NetworkRule | null = null): MatchingResult;
```

##### **matchFrame**

```ts
/**
  * Matches current frame and returns document-level allowlist rule if found.
  *
  * @param frameUrl
  */
matchFrame(frameUrl: string): NetworkRule | null;
```

##### Starting engine

```ts
import { Engine, setConfiguration } from '@adguard/tsurlfilter';

const rawFilter = [
  '[AdGuard]',
  '! Title: Example filter',
  '! Description: This is just an example filter.',
  'example.com##h1',
].join('\n');

const config = {
    engine: 'extension',
    version: '1.0.0',
    verbose: true,
};

setConfiguration(config);

// Create engine using the factory method
const engine = Engine.createSync({
    filters: [
        {
            id: 0,
            content: rawFilter,
        },
    ],
});

console.log(`Engine loaded with ${engine.getRulesCount()} rule(s)`);
```

##### Matching requests

```ts
const request = new Request(url, sourceUrl, RequestType.Document);
const result = engine.matchRequest(request);
```

##### Retrieving cosmetic data

```ts
const cosmeticResult = engine.getCosmeticResult(request, CosmeticOption.CosmeticOptionAll);
```

#### <a id="matching-result"></a>MatchingResult

MatchingResult contains all the rules matching a web request,
and provides methods that define how a web request
should be processed

##### **getBasicResult**

```ts
/**
 * GetBasicResult returns a rule that should be applied to the web request.
 * Possible outcomes are:
 * returns null -- bypass the request.
 * returns a allowlist rule -- bypass the request.
 * returns a blocking rule -- block the request.
 *
 * @returns basic result rule
 */
getBasicResult(): NetworkRule | null;
```

##### **getDocumentBlockingResult**

```ts
/**
 * Returns a rule that should block a document request.
 *
 * @returns Document blocking rule if any, null otherwise.
 */
getDocumentBlockingResult(): NetworkRule | null;
```

##### **getCosmeticOption**

This flag should be used for `getCosmeticResult(request: Request, option: CosmeticOption)`

```ts
/**
  * Returns a bit-flag with the list of cosmetic options
  *
  * @returns {CosmeticOption} mask
  */
getCosmeticOption(): CosmeticOption;
```

##### **Other rules**

```ts
/**
  * Return an array of replace rules
  */
getReplaceRules(): NetworkRule[]

/**
  * Returns an array of csp rules
  */
getCspRules(): NetworkRule[]

/**
  * Returns an array of cookie rules
  */
getCookieRules(): NetworkRule[]
```

#### <a id="cosmetic-result"></a>CosmeticResult

Cosmetic result is the representation of matching cosmetic rules.
It contains the following properties:

```ts
/**
 * Storage of element hiding rules
 */
public elementHiding: CosmeticStylesResult;

/**
 * Storage of CSS rules
 */
public CSS: CosmeticStylesResult;

/**
 * Storage of JS rules
 */
public JS: CosmeticScriptsResult;

/**
 * Storage of Html filtering rules
 */
public Html: CosmeticHtmlResult;

/**
 * Script rules
 */
public getScriptRules(): CosmeticRule[];
```

##### Applying cosmetic result - CSS

```ts
const css = [...cosmeticResult.elementHiding.generic, ...cosmeticResult.elementHiding.specific]
        .map((rule) => `${rule.getContent()} { display: none!important; }`);

const styleText = css.join('\n');
const injectDetails = {
    code: styleText,
    runAt: 'document_start',
};

chrome.tabs.insertCSS(tabId, injectDetails);
```

##### Applying cosmetic result - scripts

```ts
const cosmeticRules = cosmeticResult.getScriptRules();
const scriptsCode = cosmeticRules.map((x) => x.getScript()).join('\r\n');
const toExecute = buildScriptText(scriptsCode);

chrome.tabs.executeScript(tabId, {
    code: toExecute,
});
```

#### <a id="dns-engine"></a>DnsEngine

DNSEngine combines host rules and network rules and is supposed to quickly find matching rules for hostnames.

##### **Constructor**

```ts
/**
  * Builds an instance of dns engine
  *
  * @param storage
  */
constructor(storage: RuleStorage);
```

##### **match**

```ts
/**
 * Match searches over all filtering and host rules loaded to the engine
 *
 * @param hostname to check
 * @returns dns result object
 */
public match(hostname: string): DnsResult;
```

##### Matching hostname

```ts
const dnsResult = dnsEngine.match(hostname);
if (dnsResult.basicRule && !dnsResult.basicRule.isAllowlist()) {
    // blocking rule found
    ...
}

if (dnsResult.hostRules.length > 0) {
    // hosts rules found
    ...
}
```

#### <a id="rule-syntax-utils"></a>RuleSyntaxUtils

This module is not used in the engine directly, but it can be used in other libraries

##### Public methods

```ts
/**
 * Checks if rule can be matched by domain
 *
 * @param ruleText Rule text
 * @param domain Domain to check
 */
public static isRuleForDomain(ruleText: string, domain: string): boolean
```

```ts
/**
 * Checks if rule can be matched by URL
 *
 * @param ruleText Rule text
 * @param url URL to check
 */
public static isRuleForUrl(ruleText: string, url: string): boolean;
```

#### <a id="filter-list"></a>FilterList

`FilterList` is a class that represents a converted filter list
with efficient access to both converted and original rule content.

##### Key Features

- **Automatic Rule Conversion**: Converts filter rules to AdGuard format using `RawRuleConverter.convertToAdg()`
- **O(1) Access**: Provides constant-time access to original filtering rules via conversion data
- **Bidirectional Mapping**: Maintains mappings between converted and original rules
- **Content Restoration**: Can restore the original filter list from converted content

##### Constructor

```ts
/**
 * Creates a new FilterList instance.
 *
 * @param content Filter list content.
 * @param data Optional conversion data. If not provided, the filter list will be prepared.
 */
constructor(content: string, data?: ConversionData)
```

##### Conversion Data Structure

The `ConversionData` interface tracks the relationship between converted and original rules:

```ts
interface ConversionData {
    /**
     * Original filter list rules that were converted.
     */
    originals: string[];

    /**
     * Conversion map.
     * Maps line start offsets in the converted content to indexes in the originals array.
     * Keys are 0-based line start offsets, values are 0-based indexes in originals array.
     */
    conversions: Record<number, number>;
}
```

##### Main Methods

###### Getting Converted Content

```ts
/**
 * Returns the converted content.
 */
public getContent(): string;
```

###### Getting Rule Text

```ts
/**
 * Returns the rule text for a given offset in the converted content.
 * This may be a converted rule.
 *
 * @param offset Line start offset in the converted content.
 * @returns Rule as string, or null if not found.
 */
public getRuleText(offset: number): string | null;
```

###### Getting Original Rule Text

```ts
/**
 * Returns the original rule text for a given offset.
 * If the rule was converted, returns the original from conversion data.
 * If not converted, returns the rule text (which is already the original).
 *
 * @param offset Line start offset in the converted content.
 * @returns Original rule text, or null if offset is invalid.
 */
public getOriginalRuleText(offset: number): string | null;
```

###### Getting Converted Rule Original (Strict)

```ts
/**
 * Returns the original rule text only if the rule was actually converted.
 * Unlike getOriginalRuleText(), this returns null for unconverted rules.
 *
 * @param offset Line start offset in the converted content.
 * @returns Original rule text if converted, or null if not converted or invalid offset.
 */
public getConvertedRuleOriginal(offset: number): string | null;
```

###### Restoring Original Content

```ts
/**
 * Restores the original filter list content from the converted content.
 *
 * @returns Original filter list content.
 */
public getOriginalContent(): string;
```

##### Static Methods

```ts
/**
 * Creates an empty converted filter list.
 */
public static createEmpty(): FilterList;

/**
 * Creates an empty conversion data.
 */
public static createEmptyConversionData(): ConversionData;
```

##### Usage Example

```ts
import { FilterList } from '@adguard/tsurlfilter';

// Create a filter list (automatically converts rules)
const filterList = new FilterList('||example.com^$third-party');

// Get converted content
const converted = filterList.getContent();

// Get rule at specific offset
const rule = filterList.getRuleText(0);

// Get original rule if it was converted
const original = filterList.getOriginalRuleText(0);

// Restore full original content
const originalContent = filterList.getOriginalContent();

// Create from existing conversion data (no re-conversion)
const data = filterList.getConversionData();
const filterList2 = new FilterList(converted, data);
```

## Documentation

- [Changelog](CHANGELOG.md)
- [Development guide](../../DEVELOPMENT.md)
- [LLM agent rules](AGENTS.md)
