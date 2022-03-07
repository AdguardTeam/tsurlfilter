# TSUrlFilter

This repo contains typescript packages implementing AdGuard filtering engine.

## Packages:

- tsurlfilter
- examples/manifest-v2
- examples/manifest-v3

See packages details in `./packages`.

### TSUrlFilter

TSUrlFilter is a TypeScript library that implements AdGuard's blocking rules logic.
See details in [`./packages/tsurlfilter`](/packages/tsurlfilter/README.md).

### Sample extensions

Source code of the sample extensions is located in the directory `./packages/examples`.

To build sample manifest-v2 extension go to the one of the examples and run:
```
$ lerna bootstrap && lerna run --scope manifest-v2 build
```
Reciprocally with manifest-v3:
```
$ lerna bootstrap && lerna run --scope manifest-v3 build
```

After that it's ready to be added to Chrome using "Load unpacked" in developer mode.

To test if this extension works correctly you can use next test pages:

Test pages:
-   [Simple rules test](http://testcases.adguard.com/Filters/simple-rules/test-simple-rules.html)
-   [Script rules test](http://testcases.adguard.com/Filters/script-rules/test-script-rules.html)
-   [CSP rules test](http://testcases.adguard.com/Filters/csp-rules/test-csp-rules.html)


## Development

```
npm install -g lerna
```

```
lerna bootstrap
```

Bootstrap the packages in the current repo. Installing all their dependencies and linking any cross-dependencies.

```
lerna run test
```

Runs tests in all packages.

```
lerna run build
```

Builds the packages in the current repo.
