# TSUrlFilter - Manifest v3 Sample Extension 

This is a sample extension, presenting common usages of TSUrlFilter library in manifest v3 extensions.

## <a id="idea"></a> Idea
The idea is to provide an operative scheme of extension and to show some cases with manifest v3 limitations: 

-   Precompile rules to json [See more](#precompile)
-   Convert and set rules as dynamic declarative via `chrome.declarativeNetRequest.updateDynamicRules`
-   Find corresponding source rule for matched declarative via `chrome.declarativeNetRequest.getMatchedRules` 
-   Use an instance of TSUrlFilter.Engine to match cosmetic rules for requests
-   Apply scripts and css with manifest v3 `chrome.scripting`

Test pages:
-   [Simple rules test](http://testcases.adguard.com/Filters/simple-rules/test-simple-rules.html)
-   [Script rules test](http://testcases.adguard.com/Filters/script-rules/test-script-rules.html)

## <a id="usage"></a> Development

### <a id="build"></a> Building
Builds an extension ready to use:
```
yarn build
```

### <a id="precompile"></a> Precompile declarative rules
Converts rules in `/extension/filters/static.txt` to a set of declarative rules in `/extension/filters/declarative/rules.json`:
```
yarn build:precompile-rules
```
