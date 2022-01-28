# TSWebExtension - Manifest v3 Sample Extension 

This is a sample extension, presenting common usages of TSWebExtension library in manifest v3 extensions.

## <a id="idea"></a> Idea
The idea is to provide an operative scheme of extension and to show some cases with manifest v3 limitations: 

-   Precompile rules to json [See more](#precompile)

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
