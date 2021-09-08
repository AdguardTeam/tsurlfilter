# TSUrlFilter

[![NPM](https://nodei.co/npm/@adguard/tsurlfilter.png?compact=true)](https://www.npmjs.com/package/@adguard/tsurlfilter/)

This is a TypeScript library that implements AdGuard's content blocking rules.

*   [Idea](#idea)
*   [Usage](#usage)
    *   [API description](#api-description)
        *   [Public classes](#public-classes)
            *   [Engine](#engine)
            *   [MatchingResult](#matching-result)
            *   [CosmeticResult](#cosmetic-result)
            *   [DnsEngine](#dns-engine)
            *   [RuleConverter](#rule-converter)
            *   [ContentFiltering](#content-filtering)
            *   [StealthService](#stealth-service)
            *   [RedirectsService](#redirect-service)
            *   [CookieFiltering](#cookie-filtering)
            *   [RuleValidator](#rule-validator)
            *   [RuleSyntaxUtils](#rule-syntax-utils)
            *   [DeclarativeConverter](#declarative-converter)
        *   [Content script classes](#content-script-classes)
            *   [CssHitsCounter](#css-hits-counter)
            *   [CookieController](#cookie-controller)
    *   [Sample extensions](#sample-extensions)
*   [Development](#development)
    *   [NPM scripts](#npm-scripts)
    *   [Excluding peer dependencies](#excluding-peer-dependencies)
    *   [Git hooks](#git-hooks)

## <a id="idea"></a> Idea
The idea is to have a single library that we can reuse for the following tasks:

-   Doing content blocking in our Chrome and Firefox extensions (obviously)
-   Using this library for parsing rules and converting to Safari-compatible content blocking lists (see [AdGuard for Safari](https://github.com/AdguardTeam/AdguardForSafari), [AdGuard for iOS](https://github.com/AdguardTeam/AdguardForiOS))
-   Using this library for validating and linting filter lists (see [FiltersRegistry](https://github.com/AdguardTeam/FiltersRegistry), [AdguardFilters](https://github.com/AdguardTeam/AdguardFilters))
-   It could also be used as a basis for the [VS code extension](https://github.com/ameshkov/VscodeAdblockSyntax/)

## <a id="usage"></a> Usage

Install the tsurlfilter:
```
npm install @adguard/tsurlfilter
```

### <a id="api-description"></a> API description

#### <a id="public-classes"></a> Public classes

#### <a id="engine"></a> Engine

Engine is a main class of this library. It represents the filtering functionality for loaded rules

##### **Constructor**
```
    /**
     * Creates an instance of Engine
     * Parses filtering rules and creates a filtering engine of them
     *
     * @param ruleStorage storage
     * @param configuration optional configuration
     *
     * @throws
     */
    constructor(ruleStorage: RuleStorage, configuration?: IConfiguration | undefined)
```

##### **matchRequest**
```


    /**
     * Matches the specified request against the filtering engine and returns the matching result.
     * In case frameRules parameter is not specified, frame rules will be selected matching request.sourceUrl.
     *
     * @param request - request to check
     * @param frameRules - source rules or undefined
     * @return matching result
     */
    matchRequest(request: Request, frameRule: NetworkRule | null = null): MatchingResult
```

##### **matchFrame**
```
    /**
     * Matches current frame and returns document-level allowlist rule if found.
     *
     * @param frameUrl
     */
    matchFrame(frameUrl: string): NetworkRule | null
```

##### Starting engine
```
    const list = new StringRuleList(listId, rulesText, false, false);
    const ruleStorage = new RuleStorage([list]);

    const config = {
        engine: 'extension',
        version: '1.0.0',
        verbose: true,
    };

    setConfiguration(config)

    const engine = new Engine(ruleStorage);
```

##### Matching requests
```
    const request = new Request(url, sourceUrl, RequestType.Document);
    const result = engine.matchRequest(request);
```

##### Retrieving cosmetic data
```
    const cosmeticResult = engine.getCosmeticResult(request, CosmeticOption.CosmeticOptionAll);
```

#### <a id="matching-result"></a> MatchingResult

MatchingResult contains all the rules matching a web request, and provides methods that define how a web request should be processed

##### **getBasicResult**
```
    /**
     * GetBasicResult returns a rule that should be applied to the web request.
     * Possible outcomes are:
     * returns null -- bypass the request.
     * returns a allowlist rule -- bypass the request.
     * returns a blocking rule -- block the request.
     *
     * @return basic result rule
     */
    getBasicResult(): NetworkRule | null
```

##### **getCosmeticOption**

This flag should be used for `getCosmeticResult(request: Request, option: CosmeticOption)`

```
    /**
     * Returns a bit-flag with the list of cosmetic options
     *
     * @return {CosmeticOption} mask
     */
    getCosmeticOption(): CosmeticOption
```

##### **Other rules**
```
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

#### <a id="cosmetic-result"></a> CosmeticResult

Cosmetic result is the representation of matching cosmetic rules.
It contains the following properties:
```
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

##### Applying cosmetic result - css
```
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
```
    const cosmeticRules = cosmeticResult.getScriptRules();
    const scriptsCode = cosmeticRules.map((x) => x.getScript()).join('\r\n');
    const toExecute = buildScriptText(scriptsCode);

    chrome.tabs.executeScript(tabId, {
        code: toExecute,
    });
```

#### <a id="dns-engine"></a> DnsEngine

DNSEngine combines host rules and network rules and is supposed to quickly find matching rules for hostnames.

##### **Constructor**
```
    /**
     * Builds an instance of dns engine
     *
     * @param storage
     */
    constructor(storage: RuleStorage)
```

##### **match**
```
    /**
     * Match searches over all filtering and host rules loaded to the engine
     *
     * @param hostname to check
     * @return dns result object
     */
    public match(hostname: string): DnsResult
```

##### Matching hostname
```
    const dnsResult = dnsEngine.match(hostname);
    if (dnsResult.basicRule && !dnsResult.basicRule.isAllowlist()) {
        // blocking rule found
        ..
    }

    if (dnsResult.hostRules.length > 0) {
        // hosts rules found
        ..
    }
```

#### <a id="rule-converter"></a> RuleConverter

Before saving downloaded text with rules it could be useful to run converter on it.
The text will be processed line by line, converting each line from known external format to Adguard syntax.

##### **convertRules**

```
    /**
     * Converts rules text
     *
     * @param rulesText
     */
    public static convertRules(rulesText: string): string {
```

#### <a id="content-filtering"></a> ContentFiltering

Content filtering module, it applies html-filtering and $replace rules.
The rules could be retrieved with parsing the result of `engine.matchRequest`.

##### **Constructor**
```
    /**
     * Creates an instance of content filtering module
     *
     * @param filteringLog
     */
    constructor(filteringLog: FilteringLog)
```

##### **apply**
```
    /**
     * Applies content and replace rules to the request
     *
     * @param streamFilter stream filter implementation
     * @param request
     * @param contentType Content-Type header
     * @param replaceRules array of replace rules
     * @param htmlRules array of html-filtering rules
     */
    public apply(
        streamFilter: StreamFilter,
        request: Request,
        contentType: string,
        replaceRules: NetworkRule[],
        htmlRules: CosmeticRule[],
    ): void
```

##### Applying content-filtering rules
```
    const request = new Request(url, sourceUrl, requestType);
    request.requestId = requestId;
    request.tabId = tabId;
    request.statusCode = statusCode;
    request.method = method;

    contentFiltering.apply(
        chrome.webRequest.filterResponseData(requestId),
        request,
        'text/html; charset=utf-8',
        replaceRules,
        htmlRules,
    );
```

#### <a id="stealth-service"></a> StealthService

Stealth service module, it provides some special functionality
like removing tracking parameters and cookie modifications

##### **Constructor**
```
    /**
     * Constructor
     *
     * @param config
     */
    constructor(config: StealthConfig)
```

##### Stealth configuration
```
    const stealthConfig = {
        blockChromeClientData: false,
        hideReferrer: false,
        hideSearchQueries: false,
        sendDoNotTrack: false,
        selfDestructThirdPartyCookies: false,
        selfDestructThirdPartyCookiesTime: 0,
        selfDestructFirstPartyCookies: false,
        selfDestructFirstPartyCookiesTime: 0,
    };

    this.stealthService = new StealthService(stealthConfig);
```

##### **getCookieRulesTexts**
```
    /**
     * Returns synthetic set of rules matching the specified request
     */
    public getCookieRulesTexts(): string[]
```

##### **processRequestHeaders**
```
    /**
     * Applies stealth actions to request headers
     *
     * @param requestUrl
     * @param requestType
     * @param requestHeaders
     */
    public processRequestHeaders(
        requestUrl: string, requestType: RequestType, requestHeaders: HttpHeaders,
    ): StealthActions
```

#### <a id="redirect-service"></a> RedirectsService
Redirects service module applies `$redirect` rules.
More details on sample extension.

##### Init service
```
    const redirectsService = new RedirectsService();
    await redirectsService.init();
```

##### Usage
```
    const result = engine.matchRequest(request);
    const requestRule = result.getBasicResult();

    if (requestRule.isOptionEnabled(NetworkRuleOption.Redirect)) {
        const redirectUrl = redirectsService.createRedirectUrl(requestRule.getAdvancedModifierValue());
    }
```

#### <a id="headers-service"></a> HeadersService

Headers service module, it provides headers modification functionality.
See more about `$removeheader` modifier.

##### **Constructor**
```
    /**
     * Constructor
     *
     * @param filteringLog
     */
    constructor(filteringLog: FilteringLog)
```

#####  **onBeforeSendHeaders**
```
    /**
     * On before send headers handler.
     * Removes request headers.
     *
     * @param details
     * @param rules
     * @return if headers modified
     */
    public onBeforeSendHeaders(details: OnBeforeSendHeadersDetailsType, rules: NetworkRule[]): boolean
```

##### **getCookieRules**
```
    /**
     * On headers received handler.
     * Remove response headers.
     *
     * @param details
     * @param rules
     * @return if headers modified
     */
    public onHeadersReceived(details: OnHeadersReceivedDetailsType, rules: NetworkRule[]): boolean
```


#### <a id="cookie-filtering"></a> CookieFiltering
Cookie filtering module applies `$cookie` rules.
Adds a listener for `CookieApi.setOnChangedListener(..)` then applies rules from `RulesFinder` to event cookie.

##### **Constructor**
Check `CookieApi` and `RulesFinder` interfaces
```
    /**
     * Constructor
     *
     * @param cookieManager
     * @param filteringLog
     * @param rulesFinder
     */
    constructor(cookieManager: CookieApi, filteringLog: FilteringLog, rulesFinder: RulesFinder)
```

##### Public methods
```
    /**
     * Parses response header set-cookie.
     * Saves cookie third-party flag
     *
     * @param request
     * @param responseHeaders Response headers
     */
    processResponseHeaders(request: Request, responseHeaders: Header[]): void;

    /**
     * Filters blocking first-party rules
     *
     * @param rules
     */
    getBlockingRules(rules: NetworkRule[]): NetworkRule[];
```

#### <a id="rule-validator"></a> RuleValidator
This module is not used in the engine directly, but it can be used to validate filter rules in other libraries or tools

##### Public methods
```
    /**
     * Validates raw rule string
     * @param rawRule
     */
    public static validate(rawRule: string): ValidationResult
```
```
    /**
    * Valid true - means that the rule is valid, otherwise rule is not valid
    * If rule is not valid, reason is returned in the error field
    */
    interface ValidationResult {
        valid: boolean;
        error: string | null;
    }
```

#### <a id="rule-syntax-utils"></a> RuleSyntaxUtils
This module is not used in the engine directly, but it can be used in other libraries

##### Public methods
```
    /**
     * Checks if rule can be matched by domain
     * @param ruleText
     * @param domain
     */
    public static isRuleForDomain(ruleText: string, domain: string): boolean {
```
```
    /**
     * Checks if rule can be matched by url
     * @param ruleText
     * @param url
     */
    public static isRuleForUrl(ruleText: string, url: string): boolean {
```

#### <a id="declarative-converter"></a> DeclarativeConverter
Provides a functionality of conversion AG rules to manifest v3 declarative syntax. See `examples/manifest-v3/` for an example usage.

##### Public methods
```
    /**
     * Converts a set of rules to declarative rules array
     *
     * @param ruleList
     */
    public convert(ruleList: IRuleList): DeclarativeRule[] {
```

#### <a id="content-script-classes"></a> Content script classes
Classes provided for page context:

#### <a id="css-hits-counter"></a> CssHitsCounter
Class represents collecting css style hits process.

##### Initialization:
```
    const cssHitsCounter = new CssHitsCounter((stats) => {
        chrome.runtime.sendMessage({type: "saveCssHitStats", stats: JSON.stringify(stats)});
    });
```

#### <a id="cookie-controller"></a> CookieController
This class applies cookie rules in page context

##### Usage:
```
    const rulesData = rules.map((rule) => {
        return {
            ruleText: rule.getText(),
            match: rule.getAdvancedModifierValue(),
        };
    });

    const cookieController = new CookieController((rule) => {
        console.debug('On cookie rule applied');
    });

    cookieController.apply(rulesData);
```

### <a id="sample-extensions"></a> Sample extensions

Source code of the sample extensions is located in the directory `examples`

To build sample extension go to the one of the examples and run
```
yarn && yarn build
```

This command builds tsurlfilter library and extension to `build` directory. After that it's ready to be added to Chrome using "Load unpacked" in developer mode.

To test if this extension works correctly you can use next test pages:

Test pages:
-   [Simple rules test](http://testcases.adguard.com/Filters/simple-rules/test-simple-rules.html)
-   [Script rules test](http://testcases.adguard.com/Filters/script-rules/test-script-rules.html)
-   [CSP rules test](http://testcases.adguard.com/Filters/csp-rules/test-csp-rules.html)

## Development

### <a id="npm-scripts"></a> NPM scripts

-   `npm t`: Run test suite
-   `npm start`: Run `npm run build` in watch mode
-   `npm run test:watch`: Run test suite in [interactive watch mode](https://jestjs.io/docs/en/cli#--watch)
-   `npm run test:prod`: Run linting and generate coverage
-   `npm run test:benchmarks`: Run benchmark tests, inspect in `chrome://inspect`
-   `npm run build`: Generate bundles and typings, create docs
-   `npm run lint`: Lints code
-   `npm run commit`: Commit using conventional commit style ([husky](https://github.com/typicode/husky) will tell you to use it if you haven't :wink:)
-   `npm run build-extension`: Build sample chrome extension

### <a id="excluding-peer-dependencies"></a> Excluding peerDependencies

On library development, one might want to set some peer dependencies, and thus remove those from the final bundle. You can see in [Rollup docs](https://rollupjs.org/#peer-dependencies) how to do that.

Good news: the setup is here for you, you must only include the dependency name in `external` property within `rollup.config.js`. For example, if you want to exclude `lodash`, just write there `external: ['lodash']`.

### <a id="git-hooks"></a> Git Hooks

There is already set a `precommit` hook for formatting your code with Eslint :nail_care:
