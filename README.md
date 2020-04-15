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
    -   [ ] Domain semantics: https://github.com/AdguardTeam/AdguardBrowserExtension/issues/1474
    -   [ ] Domain semantics: AG-254
-   [x] Benchmark basic rules matching
-   [ ] Hosts matching rules
    -   [ ] /etc/hosts matching
    -   [ ] Network host-level rules: https://github.com/AdguardTeam/urlfilter/blob/v0.7.0/rules/network_rule.go#L213
    -   [ ] \$badfilter support for host-blocking network rules
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
    -   [ ] \$redirect
    -   [ ] \$badfilter (see this as well: https://github.com/AdguardTeam/CoreLibs/issues/1241)
    -   [ ] \$stealth modifier
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

