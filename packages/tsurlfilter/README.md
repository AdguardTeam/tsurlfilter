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
        - [Sync mode](#sync-mode)
        - [Async mode](#async-mode)
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
      - [**Constructor**](#constructor-1)
      - [**match**](#match)
      - [Matching hostname](#matching-hostname)
    - [RuleSyntaxUtils](#rulesyntaxutils)
      - [Public methods](#public-methods)
    - [FilterListPreprocessor](#filterlistpreprocessor)
      - [Understanding the data structure](#understanding-the-data-structure)
        - [Requirements](#requirements)
        - [`PreprocessedFilterList` interface](#preprocessedfilterlist-interface)
        - [Example to illustrate the requirements](#example-to-illustrate-the-requirements)
      - [Public methods](#public-methods-1)
    - [DeclarativeFilterConverter](#declarativefilterconverter)
      - [Public methods](#public-methods-2)
      - [Example of use](#example-of-use)
      - [Declarative converter documentation](#declarative-converter-documentation)
      - [Problems](#problems)
- [Development](#development)
  - [NPM scripts](#npm-scripts)
  - [Excluding peerDependencies](#excluding-peerdependencies)
  - [Git Hooks](#git-hooks)

## <a id="idea"></a>Idea

The idea is to have a single library that we can reuse for the following tasks:

- Doing content blocking in our Chrome and Firefox extensions (obviously)
- Using this library for parsing rules and converting to Safari-compatible content blocking lists (see [AdGuard for Safari](https://github.com/AdguardTeam/AdguardForSafari), [AdGuard for iOS](https://github.com/AdguardTeam/AdguardForiOS))
- Using this library for validating and linting filter lists (see [FiltersRegistry](https://github.com/AdguardTeam/FiltersRegistry), [AdguardFilters](https://github.com/AdguardTeam/AdguardFilters))

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

###### **Sync mode**

Create engine synchronously. It converts all rules before creating the engine.

```ts
/**
 * Creates an instance of the network engine in sync mode.
 * Sync mode converts all rules before creating the engine.
 *
 * @param options Engine factory options.
 *
 * @returns An instance of the network engine.
 */
public static createSync(options: EngineFactoryOptions): Engine;
```

###### **Async mode**

Create engine asynchronously. We use this approach in AdGuard browser extension to avoid UI lags.
It does not convert rules before creating the engine, in this case, library user should handle conversion process.

```ts
/**
 * Creates an instance of the network engine in async mode.
 * Async mode does not convert rules before creating the engine.
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
            text: '||example.com^',
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
import {
    BufferRuleList,
    Engine,
    FilterListPreprocessor,
    RuleStorage,
    setConfiguration,
} from '@adguard/tsurlfilter';

const rawFilter = [
  '[AdGuard]',
  '! Title: Example filter',
  '! Description: This is just an example filter.',
  'example.com##h1',
].join('\n');

// Practically, you can read this data from the storage
const processedFilter = FilterListPreprocessor.preprocess(rawFilter);
const list = new BufferRuleList(0, processedFilter.filterList, false, false, false, processedFilter.sourceMap);
const ruleStorage = new RuleStorage([list]);

const config = {
    engine: 'extension',
    version: '1.0.0',
    verbose: true,
};

setConfiguration(config);

const engine = new Engine(ruleStorage);

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

MatchingResult contains all the rules matching a web request, and provides methods that define how a web request should be processed

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
 * @param node Rule node
 * @param domain Domain to check
 */
public static isRuleForDomain(node: AnyRule, domain: string): boolean
```

```ts
/**
 * Checks if rule can be matched by URL
 *
 * @param node Rule node
 * @param url URL to check
 */
public static isRuleForUrl(node: AnyRule, url: string): boolean;
```

#### <a id="filter-list-preprocessor"></a>FilterListPreprocessor

Provides a utility to process filter lists before using them in the engine.

##### Understanding the data structure

###### Requirements

The processed data structure must meet two requirements:

1. Provide the data necessary for the operation of the filtering engine:
   - Binary serialized filter list without invalid rules and comments
2. Make it possible to display the applied rules (and their original equivalent) in the filtering log
   (only for debugging purposes):
   - Source map (maps the start index in the serialized buffer to the line start index in the raw filter list)
   - Raw filter list
   - Conversion map (maps the start index in the raw filter list to the original rule, if the rule was converted)

###### `PreprocessedFilterList` interface

```ts
/**
 * Represents a preprocessed filter list.
 */
interface PreprocessedFilterList {
    /**
     * Raw filter list, but rules are converted to the AdGuard format.
     */
    rawFilterList: string;

    /**
     * Serialized version of the rawFilterList.
     */
    filterList: Uint8Array[];

    /**
     * Mapping between the original and converted rules.
     * Key is the line start index in the rawFilterList, value is the converted rule.
     */
    conversionMap: Record<string, string>;

    /**
     * Source map for the rawFilterList. Key is the start index in the serialized buffer, value is the line start index in the rawFilterList.
     */
    sourceMap: Record<string, number>;
}
```

###### Example to illustrate the requirements

Suppose we want to use the following filter list:

```adblock
! Title: Test filter list
example.com##+js(set, foo, 1)
example.com##h1
```

As you can see, the filter list contains two rules:

- first is a uBO rule, and
- the second is a common rule (which is compatible with AdGuard).

Before loading this list into the engine, we have to convert its rules to AdGuard format.
So we need such a `rawFilterList`:

```adblock
! Title: Test filter list
example.com#%#//scriptlet('ubo-set', 'foo', '1')
example.com##h1
```

and its binary serialized form, which will be used by the engine: `filterList`.

When we initialize the engine, it scans the byte buffer `filterList` and builds the filtering engine, lookup tables, etc.
and assigns the start indexes from the byte buffer `filterList` to the TSUrlFilter rule instances.

We don't know anything about the original rules at the engine level and we don't need to know it.

However, on the extension level, we know all of the properties of the preprocessed filter list.
When a rule is applied, engine reports us the applied TSUrlFilter rule instance and its start index in the byte buffer `filterList`.

So, when we want to display the applied rule in the filtering log, we can do the following:

1. We will receive the byte buffer start index for the applied rule from the engine.
1. To get the **applied rule text**, we will use the `sourceMap` property to map the byte buffer start index to the line start index in the `rawFilterList`,
   - We can do this with the `getRuleSourceIndex` helper method:

     ```ts
     const lineStartIndex = getRuleSourceIndex(byteBufferStartIndex, sourceMap);
     ```

   - We can get rule text from the `rawFilterList` by the line start index with the `getRuleSourceText` helper function:

     ```ts
     const ruleText = getRuleSourceText(lineStartIndex, rawFilterList);
     ```

1. To get the **original rule text**, we will use the `conversionMap` property to find the original rule text from the line start index in the `rawFilterList`, if we have a key in the `conversionMap` for the start index, we will get the original rule text

For example, for the first rule, the applied rule text will be `example.com#%#//scriptlet('ubo-set', 'foo', '1')`
and the original rule text will be `example.com##+js(set, foo, 1)`.
For the second rule, the applied rule text will be `example.com##h1` and the original rule text will be `undefined`,
which means that the rule was not converted.

##### Public methods

```ts
/**
 * Processes the raw filter list and converts it to the AdGuard format.
 *
 * @param filterList Raw filter list to convert.
 * @param parseHosts If true, the preprocessor will parse host rules.
 * @returns A {@link PreprocessedFilterList} object which contains the converted filter list,
 * the mapping between the original and converted rules, and the source map.
 */
public static preprocess(filterList: string, parseHosts = false): PreprocessedFilterList;
```

```ts
/**
 * Gets the original filter list text from the preprocessed filter list.
 *
 * @param preprocessedFilterList Preprocessed filter list.
 * @returns Original filter list text.
 */
public static getOriginalFilterListText(preprocessedFilterList: RawListWithConversionMap): string;
```

```ts
/**
 * Gets the original rules from the preprocessed filter list.
 *
 * @param preprocessedFilterList Preprocessed filter list.
 * @returns Array of original rules.
 */
public static getOriginalRules(preprocessedFilterList: RawListWithConversionMap): string[];
```

where

```ts
type RawListWithConversionMap = Pick<PreprocessedFilterList, 'rawFilterList' | 'conversionMap'>;
```

#### <a id="declarative-filter-converter"></a>DeclarativeFilterConverter

Converts a list of IFilters to a single ruleset or to a list of rulesets. See `examples/manifest-v3/` for an example usage.

##### Public methods

```ts
/**
 * Extracts content from the provided static filter and converts to a set
 * of declarative rules with error-catching non-convertible rules and
 * checks that converted ruleset matches the constraints (reduce if not).
 *
 * @param filterList List of {@link IFilter} to convert.
 * @param options Options from {@link DeclarativeConverterOptions}.
 *
 * @throws Error {@link UnavailableFilterSourceError} if filter content
 * is not available OR some of {@link ResourcesPathError},
 * {@link EmptyOrNegativeNumberOfRulesError},
 * {@link NegativeNumberOfRulesError}
 * @see {@link DeclarativeFilterConverter#checkConverterOptions}
 * for details.
 *
 * @returns Item of {@link ConversionResult}.
 */
convertStaticRuleSet(
    filterList: IFilter,
    options?: DeclarativeConverterOptions,
): Promise<ConversionResult>;
```

```ts
/**
 * Extracts content from the provided list of dynamic filters and converts
 * all together into one set of rules with declarative rules.
 * During the conversion, it catches unconvertible rules and checks if
 * the converted ruleset matches the constraints (reduce if not).
 *
 * @param filterList List of {@link IFilter} to convert.
 * @param staticRuleSets List of already converted static rulesets. It is
 * needed to apply $badfilter rules from dynamic rules to these rules from
 * converted filters.
 * @param options Options from {@link DeclarativeConverterOptions}.
 *
 * @throws Error {@link UnavailableFilterSourceError} if filter content
 * is not available OR some of {@link ResourcesPathError},
 * {@link EmptyOrNegativeNumberOfRulesError},
 * {@link NegativeNumberOfRulesError}.
 * @see {@link DeclarativeFilterConverter#checkConverterOptions}
 * for details.
 *
 * @returns Item of {@link ConversionResult}.
 */
convertDynamicRuleSets(
    filterList: IFilter[],
    staticRuleSets: IRuleSet[],
    options?: DeclarativeConverterOptions,
): Promise<ConversionResult>;
```

##### Example of use

```ts
import { CompatibilityTypes, FilterListPreprocessor, setConfiguration } from '@adguard/tsurlfilter';
import { DeclarativeFilterConverter, Filter } from '@adguard/tsurlfilter/es/declarative-converter';

const rawFilter1 = [
    '||example.com^$document',
    '/ads.js^$script,third-party,domain=example.com|example.net',
].join('\n');

const rawFilter2 = [
    '||example.com^$document',
    '-ad-350-',
    // flags second rule from rawFilter1 as badfilter
    '/ads.js^$script,third-party,domain=example.com|example.net,badfilter',
].join('\n');

setConfiguration({
    engine: 'extension',
    version: '3',
    verbose: true,
    compatibility: CompatibilityTypes.Extension,
});

const converter = new DeclarativeFilterConverter();

let filterId = 0;

;(async () => {
    const { ruleSet: staticRuleSet } = await converter.convertStaticRuleSet(
        new Filter(filterId++, {
            getContent: () => Promise.resolve(FilterListPreprocessor.preprocess(rawFilter1)),
        }),
    );

    // get declarative rules from static ruleset
    console.log(await staticRuleSet.getDeclarativeRules());

    const { declarativeRulesToCancel, ruleSet: dynamicRuleSet } = await converter.convertDynamicRuleSets(
        [
            new Filter(filterId++, {
                getContent: () => Promise.resolve(FilterListPreprocessor.preprocess(rawFilter2)),
            }),
        ],
        [staticRuleSet],
    );

    // will print rule from rawFilter1 which flagged as badfilter
    console.log(declarativeRulesToCancel);

    // get declarative rules from dynamic ruleset
    console.log(await dynamicRuleSet.getDeclarativeRules());
})();
```

##### Declarative converter documentation

For more information about the declarative converter, see the its [documentation](https://github.com/AdguardTeam/tsurlfilter/blob/master/packages/tsurlfilter/src/rules/declarative-converter/README.md).

##### Problems

[QueryTransform](https://developer.chrome.com/docs/extensions/reference/declarativeNetRequest/#type-QueryTransform)

- Regexp is not supported in remove params
- We cannot implement inversion in remove params
- We cannot filter by request methods
- Only one rule applies for a redirect. For this reason, different rules with the same url may not work. Example below:

```adblock
! Works
||testcases.adguard.com$removeparam=p1case6|p2case6

! Failed
||testcases.adguard.com$removeparam=p1case6

! Works
||testcases.adguard.com$removeparam=p2case6
```

## Converting filters to declarative rulesets

This library provides a utility to convert AdGuard filter lists and metadata into declarative rulesets suitable for browser extensions or other use cases. This can be accessed both programmatically (API) and via the CLI.

### API usage

You can use the `convertFilters` function directly in your TypeScript/JavaScript code:

```ts
import { convertFilters } from '@adguard/tsurlfilter/cli/convertFilters';

// Example usage:
await convertFilters(
  './filters',           // Path to directory containing filter files and metadata (e.g., filters.json)
  './resources',         // Path to web-accessible resources (can be obtained via `@adguard/tswebextension` CLI's `war` command)
  './build/rulesets',    // Destination directory for generated rulesets
  {
    debug: true,         // (optional) Print additional debug information
    prettifyJson: true,  // (optional) Prettify JSON output (default: true)
    additionalProperties: {
      // (optional) Additional properties to include in metadata ruleset
      // This field is not validated, but it must be JSON serializable.
      // Validation should be performed by users.
      version: '1.2.3',
    },
  }
);
```

**Parameters:**
- `filtersAndMetadataDir` (string): Path to the directory with filter files and metadata (should contain e.g. `filters.json`).
- `resourcesDir` (string): Path to web-accessible resources (used for ruleset generation).
- `destRulesetsDir` (string): Output directory for the resulting declarative rulesets.
- `options` (object, optional):
    - `debug` (boolean): Print debug info to console (default: false).
    - `prettifyJson` (boolean): Prettify JSON output (default: true).
    - `additionalProperties` (object): Additional properties to include in metadata ruleset. This field is not validated, but it must be JSON serializable. Validation should be performed by users.

### CLI usage

You can perform the same conversion using the CLI:

```sh
npx tsurlfilter convert <filtersAndMetadataDir> <resourcesDir> [destRulesetsDir] [options]
```

**Arguments:**
- `<filtersAndMetadataDir>`: Path to directory with filter files and metadata (should contain e.g. `filters.json`).
- `<resourcesDir>`: Path to web-accessible resources.
- `[destRulesetsDir]`: (Optional) Output directory for the resulting declarative rulesets. Defaults to `./build/rulesets` if omitted.

**Options:**
- `--debug`           Enable debug mode (default: false)
- `--prettify-json`   Prettify JSON output (default: true)

**Example:**
```sh
npx tsurlfilter convert ./filters ./resources ./build/rulesets --debug --prettify-json
```

See the output directory for the generated rulesets and metadata.

#### Extracting filters from rulesets

You can also extract original filters from previously converted declarative rulesets using the CLI:

```sh
npx tsurlfilter extract-filters <path-to-rulesets> <path-to-output>
```

**Arguments:**
- `<path-to-rulesets>`: Path to the directory containing the declarative rulesets (as generated by the `convert` command).
- `<path-to-output>`: Path to the file or directory where the extracted filters will be saved.

**Example:**
```sh
npx tsurlfilter extract-filters ./build/rulesets ./filters
```

This will extract the filters from the rulesets and their metadata and save these files to the specified output path.

## Development

This project is part of the `@adguard/extensions` monorepo.
It is highly recommended to use `lerna` for commands as it will execute scripts in the correct order and can cache dependencies.

```sh
npx lerna run --scope=@adguard/tsurlfilter:<script>
```

### <a id="npm-scripts"></a>NPM scripts

- `lint`: Run ESLint and TSC
- `lint:code`: Run ESLint
- `lint:types`: Run TSC
- `start` Start build in watch mode
- `build`: Build the project
- `build:types`: Generate types
- `docs`: Generate documentation
- `docs:mv3`: Generate documentation for manifest v3
- `test`: Run tests
- `test:light`: Run tests without benchmarks
- `test:watch`: Run tests in watch mode
- `test:coverage`: Run tests with coverage
- `test:smoke`: Run smoke tests
- `test:prod`: Run production tests, i.e lint, smoke tests, and tests
- `report-coverage`: Report coverage to coveralls

### <a id="excluding-peer-dependencies"></a>Excluding peerDependencies

On library development, one might want to set some peer dependencies, and thus remove those from the final bundle. You can see in [Rollup docs](https://rollupjs.org/#peer-dependencies) how to do that.

Good news: the setup is here for you, you must only include the dependency name in `external` property within `rollup.config.js`. For example, if you want to exclude `lodash`, just write there `external: ['lodash']`.

### <a id="git-hooks"></a>Git Hooks

There is already set a `precommit` hook for formatting your code with Eslint :nail_care:
