# TSUrlFilter

[![NPM](https://nodei.co/npm/@adguard/tsurlfilter.png?compact=true)](https://www.npmjs.com/package/@adguard/tsurlfilter/)

This is a TypeScript library that implements AdGuard's content blocking rules.

- [TSUrlFilter](#tsurlfilter)
  - [ Idea](#-idea)
  - [ Usage](#-usage)
    - [ API description](#-api-description)
      - [ Public classes](#-public-classes)
      - [ Engine](#-engine)
        - [**Constructor**](#constructor)
        - [**matchRequest**](#matchrequest)
        - [**matchFrame**](#matchframe)
        - [Starting engine](#starting-engine)
        - [Matching requests](#matching-requests)
        - [Retrieving cosmetic data](#retrieving-cosmetic-data)
      - [ MatchingResult](#-matchingresult)
        - [**getBasicResult**](#getbasicresult)
        - [**getCosmeticOption**](#getcosmeticoption)
        - [**Other rules**](#other-rules)
      - [ CosmeticResult](#-cosmeticresult)
        - [Applying cosmetic result - css](#applying-cosmetic-result---css)
        - [Applying cosmetic result - scripts](#applying-cosmetic-result---scripts)
      - [ DnsEngine](#-dnsengine)
        - [**Constructor**](#constructor-1)
        - [**match**](#match)
        - [Matching hostname](#matching-hostname)
      - [ RuleConverter](#-ruleconverter)
        - [**convertRules**](#convertrules)
      - [ RuleValidator](#-rulevalidator)
        - [Public methods](#public-methods)
      - [ RuleSyntaxUtils](#-rulesyntaxutils)
        - [Public methods](#public-methods-1)
      - [ DeclarativeConverter](#-declarativeconverter)
        - [Public methods](#public-methods-2)
        - [Problems](#problems)
  - [Development](#development)
    - [ NPM scripts](#-npm-scripts)
    - [ Excluding peerDependencies](#-excluding-peerdependencies)
    - [ Git Hooks](#-git-hooks)

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
##### Problems
[QueryTransform](https://developer.chrome.com/docs/extensions/reference/declarativeNetRequest/#type-QueryTransform)
- Regexp is not supported in remove params
- We cannot implement inversion in remove params
- We cannot filter by request methods
- Only one rule applies for a redirect. For this reason, different rules with the same url may not work. Example below:
```
Works   ||testcases.adguard.com$removeparam=p1case6|p2case6

Failed  ||testcases.adguard.com$removeparam=p1case6
Works   ||testcases.adguard.com$removeparam=p2case6
```

## Development

This project is part of the `tsurlfilter` monorepo.
It is highly recommended to use both `lerna` and `nx` for commands, as it will execute scripts in the correct order and can cache dependencies.

```sh
npx nx run @adguard/tsurlfilter:<script>
```

### <a id="npm-scripts"></a> NPM scripts

-   `t`: Run test suite
-   `start`: Run `build` in watch mode
-   `test:watch`: Run test suite in [interactive watch mode](https://jestjs.io/docs/en/cli#--watch)
-   `test:prod`: Run linting and generate coverage
-   `build`: Generate bundles and typings, create docs
-   `lint`: Lints code

### <a id="excluding-peer-dependencies"></a> Excluding peerDependencies

On library development, one might want to set some peer dependencies, and thus remove those from the final bundle. You can see in [Rollup docs](https://rollupjs.org/#peer-dependencies) how to do that.

Good news: the setup is here for you, you must only include the dependency name in `external` property within `rollup.config.js`. For example, if you want to exclude `lodash`, just write there `external: ['lodash']`.

### <a id="git-hooks"></a> Git Hooks

There is already set a `precommit` hook for formatting your code with Eslint :nail_care:
