# tsurlfilter

This is a TypeScript library that implements AdGuard's content blocking rules.

The idea is to have a single library that we can reuse for the following tasks:

-   Doing content blocking in our Chrome and Firefox extensions (obviously)
-   Using this library for parsing rules and converting to Safari-compatible content blocking lists (see [AdGuard for Safari](https://github.com/AdguardTeam/AdguardForSafari), [AdGuard for iOS](https://github.com/AdguardTeam/AdguardForiOS))
-   Using this library for validating and linting filter lists (see [FiltersRegistry](https://github.com/AdguardTeam/FiltersRegistry), [AdguardFilters](https://github.com/AdguardTeam/AdguardFilters))
-   It could also be used as a basis for the [VS code extension](https://github.com/ameshkov/VscodeAdblockSyntax/).

### NPM scripts

-   `npm t`: Run test suite
-   `npm start`: Run `npm run build` in watch mode
-   `npm run test:watch`: Run test suite in [interactive watch mode](http://facebook.github.io/jest/docs/cli.html#watch)
-   `npm run test:prod`: Run linting and generate coverage
-   `npm run build`: Generate bundles and typings, create docs
-   `npm run lint`: Lints code
-   `npm run commit`: Commit using conventional commit style ([husky](https://github.com/typicode/husky) will tell you to use it if you haven't :wink:)
-   `npm run build-extension`: Build sample chrome extension

### Excluding peerDependencies

On library development, one might want to set some peer dependencies, and thus remove those from the final bundle. You can see in [Rollup docs](https://rollupjs.org/#peer-dependencies) how to do that.

Good news: the setup is here for you, you must only include the dependency name in `external` property within `rollup.config.js`. For example, if you want to exclude `lodash`, just write there `external: ['lodash']`.

### Git Hooks

There is already set a `precommit` hook for formatting your code with Eslint :nail_care:

### TODO

-   [ ] Basic filtering rules
    -   [x] Core blocking syntax
    -   [x] Basic network engine
    -   [x] Basic rules validation (don't match everything, unexpected modifiers, etc)
    -   [x] Domain semantics: https://github.com/AdguardTeam/AdguardBrowserExtension/issues/1474
    -   [x] Domain semantics: AG-254
-   [x] Benchmark basic rules matching
-   [x] Hosts matching rules
    -   [x] /etc/hosts matching
    -   [x] Network host-level rules: https://github.com/AdguardTeam/urlfilter/blob/v0.7.0/rules/network_rule.go#L213
    -   [x] \$badfilter support for host-blocking network rules
-   [ ] Memory optimization
-   [ ] Tech document
-   [ ] Cosmetic rules
    -   [x] Basic element hiding and CSS rules
        -   [x] Proper CSS rules validation
    -   [x] ExtCSS rules
        -   [x] ExtCSS rules validation
    -   [x] Scriptlet rules
    -   [x] JS rules
-   [x] Basic filtering engine implementation
    -   [x] Handling cosmetic modifiers $elemhide, $generichide, \$jsinject
    -   [x] Advanced modifiers part 1
        -   [x] \$important
        -   [x] \$badfilter
    -   [x] Web extension example
-   [x] HTML filtering rules
-   [ ] Advanced modifiers
    -   [x] \$important
    -   [x] \$replace
    -   [x] \$csp
    -   [x] \$cookie
    -   [x] \$redirect
    -   [x] \$badfilter (see this as well: https://github.com/AdguardTeam/CoreLibs/issues/1241)
    -   [x] \$stealth modifier
    -   [ ] \$ping modifier (https://github.com/AdguardTeam/AdguardBrowserExtension/issues/1584)
    
### Chrome sample extension

```
./sample-extension
```

There is a sample unpacked extension with an engine built from sources.
Test pages: 
http://testcases.adguard.com/Filters/simple-rules/test-simple-rules.html
http://testcases.adguard.com/Filters/script-rules/test-script-rules.html
http://testcases.adguard.com/Filters/csp-rules/test-csp-rules.html

```
npm run build-extension
```

Builds extension to `./dist-extension`. After that it's ready to be added to chrome using "Load unpacked".

### Public classes

#### Engine

Engine is a main class of this library. It represents the filtering functionality for loaded rules

###### **Constructor**
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

###### **matchRequest**
```
    /**
     * Matches the specified request against the filtering engine and returns the matching result.
     *
     * @param request - request to check
     * @return matching result
     */
    matchRequest(request: Request): MatchingResult
```

###### **getCosmeticResult**
```
    /**
     * Gets cosmetic result for the specified hostname and cosmetic options
     *
     * @param hostname host to check
     * @param option mask of enabled cosmetic types
     * @return cosmetic result
     */
    getCosmeticResult(hostname: string, option: CosmeticOption): CosmeticResult
```

##### Starting engine
```
    const list = new StringRuleList(listId, rulesText, false);
    const ruleStorage = new RuleStorage([list]);

    const config = {
        engine: 'extension',
        version: '1.0.0',
        verbose: true,
    };

    const engine = new Engine(ruleStorage, config);
```

##### Matching requests
```
    const request = new Request(url, sourceUrl, RequestType.Document);
    const result = engine.matchRequest(request);
```

##### Retrieving cosmetic data
```
    const cosmeticResult = engine.getCosmeticResult(hostname, CosmeticOption.CosmeticOptionAll);
```

#### MatchingResult

MatchingResult contains all the rules matching a web request, and provides methods that define how a web request should be processed

##### **getBasicResult**
```
    /**
     * GetBasicResult returns a rule that should be applied to the web request.
     * Possible outcomes are:
     * returns null -- bypass the request.
     * returns a whitelist rule -- bypass the request.
     * returns a blocking rule -- block the request.
     *
     * @return basic result rule
     */
    getBasicResult(): NetworkRule | null
```

##### **getCosmeticOption**

This flag should be used for `getCosmeticResult(hostname: string, option: CosmeticOption)`

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

#### CosmeticResult

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
    const scriptsCode = cosmeticRules.map((x) => x.script).join('\r\n');
    const toExecute = buildScriptText(scriptsCode);

    chrome.tabs.executeScript(tabId, {
        code: toExecute,
    });
```

#### RuleConverter

Before saving downloaded text with rules it could be useful to run converter on it.
The text will be processed line by line, converting each line from known external format to Adguard syntax.

###### **convertRules**

```
    /**
     * Converts rules text
     *
     * @param rulesText
     */
    public static convertRules(rulesText: string): string {
```


#### ContentFiltering

Content filtering module, it applies html-filtering and $replace rules.
The rules could be retrieved with parsing the result of `engine.matchRequest`. 

###### **Constructor**
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


#### StealthService

Stealth service module, it provides some special functionality 
like removing tracking parameters and cookie modifications

###### **Constructor**
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
        stripTrackingParameters: true,
        trackingParameters: 'utm_source,utm_medium,utm_term',
        selfDestructThirdPartyCookies: true,
        selfDestructThirdPartyCookiesTime: 0,
        selfDestructFirstPartyCookies: true,
        selfDestructFirstPartyCookiesTime: 1,
    };

    this.stealthService = new StealthService(stealthConfig);
```
#####  **removeTrackersFromUrl**
```
    /**
     * Strips out the tracking codes/parameters from a URL and return the cleansed URL
     *
     * @param request
     */
    public removeTrackersFromUrl(request: Request): string | null
```

##### **getCookieRules**
```
    /**
     * Returns synthetic set of rules matching the specified request
     */
    public getCookieRules(request: Request): NetworkRule[]
```

#### RedirectsService
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

#### CookieFiltering
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

### Content script classes
Classes provided for page context.

#### CssHitsCounter
Class represents collecting css style hits process.

##### Initialization: 
```
    const cssHitsCounter = new CssHitsCounter((stats) => {
        chrome.runtime.sendMessage({type: "saveCssHitStats", stats: JSON.stringify(stats)});
    });
```

#### CookieController
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
