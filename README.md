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

### Excluding peerDependencies

On library development, one might want to set some peer dependencies, and thus remove those from the final bundle. You can see in [Rollup docs](https://rollupjs.org/#peer-dependencies) how to do that.

Good news: the setup is here for you, you must only include the dependency name in `external` property within `rollup.config.js`. For example, if you want to exclude `lodash`, just write there `external: ['lodash']`.

### Git Hooks

There is already set a `precommit` hook for formatting your code with Prettier :nail_care:

### TODO

-   [ ] Basic filtering rules
    -   [x] Core blocking syntax
    -   [ ] Basic network engine
    -   [ ] Basic rules validation (don't match everything, unexpected modifiers, etc)
-   [ ] Benchmark basic rules matching
-   [ ] Hosts matching rules
    -   [ ] /etc/hosts matching
-   [ ] Memory optimization
-   [ ] Tech document
-   [ ] Cosmetic rules
    -   [ ] Basic element hiding and CSS rules
        -   [ ] Proper CSS rules validation
    -   [ ] ExtCSS rules
    -   [ ] Scriptlet rules
    -   [ ] JS rules
-   [ ] Basic filtering engine implementation
    -   [ ] Handling cosmetic modifiers $elemhide, $generichide, \$jsinject
    -   [ ] Advanced modifiers part 1
        -   [ ] \$important
        -   [ ] \$badfilter
    -   [ ] Web extension example
-   [ ] HTML filtering rules
-   [ ] Advanced modifiers part 2
    -   [ ] \$replace
    -   [ ] \$csp
    -   [ ] \$cookie
    -   [ ] \$redirect
