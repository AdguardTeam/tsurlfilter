# TSUrlFilter libraries

This repo contains typescript packages that implement AdGuard filtering engine.

## Packages

- `tsurlfilter`
- `tswebextension`
- `adguard-api`
- `agtree`
- `examples/manifest-v2`
- `examples/manifest-v3`
- `examples/tswebextension-example`
- `examples/tswebextension-mv3`

See packages details in `./packages`.

### TSUrlFilter

TSUrlFilter is a TypeScript library that implements AdGuard's blocking rules
logic. See details in [`./packages/tsurlfilter`][tsurlfilterreadme].

[tsurlfilterreadme]: /packages/tsurlfilter/README.md

### TSWebExtension

TSWebExtension is a TypeScript library that wraps webextension api for the
tsurlfilter library. See details in
[`./packages/tswebextension`][tswebextensionreadme].

[tswebextensionreadme]: /packages/tswebextension/README.md

### AdGuard API

AdGuard API is a TypeScript filtering library that provides filter list
management, ad filtering via [@adguard/tswebextension][tswebextensionreadme].
See details in [`./packages/adguard-api`][adguardapireadme].

[adguardapireadme]: /packages/adguard-api/README.md

### AGTree

AGTree is an AST implementation for adguard filtering rules. See details in
[`./packages/agtree`][agtreereadme].

[agtreereadme]: /packages/agtree/README.md

## Development

Prepare your local environment.

```shell
# Install dev dependencies and lerna locally.
yarn install

# Prepare and build tswebextension package as they are required for
# bootstrapping examples.
npx lerna bootstrap --scope=@adguard/tswebextension --include-dependencies
npx lerna run build --scope=@adguard/tswebextension

# Bootstrap all packages.
npx lerna bootstrap
```

Bootstraps packages in the current repo. Installs all their dependencies and
linking any cross-dependencies.

**Note**: If you want to use another linked packages in monorepo workspace, link
it in root folder.

Runs tests in all packages:

```shell
npx lerna run test
```

Builds the packages in the current repo:

```shell
npx lerna run build
```

### Sample extensions

Source code of sample extensions can be found in `./packages/examples`.

- `npx lerna run build --scope tswebextension-mv2` - MV2 sample extension.
- `npx lerna run build --scope tswebextension-mv3` - MV3 sample extension.
- `npx lerna run build --scope adguard-api-example` - AdGuard API example.

To test if this extension works correctly you can use the following test pages:

Test pages:

- [Simple rules test][testcasessimplerules]
- [Script rules test][testcasesscriptrules]

[testcasessimplerules]: https://testcases.agrd.dev/Filters/simple-rules/test-simple-rules.html
[testcasesscriptrules]: https://testcases.agrd.dev/Filters/script-rules/test-script-rules.html

### Visual Studio Code Workspace

If you're using Visual Studio Code for development, it may be easier to work
with the monorepo if you use the workspace functionality. To do this, create a
`tsurlfilter.code-workspace` file in the monorepo root directory.

`jest.runMode` and `jest.enable` would be useful to those that use
[Jest][jestplugin] plugin.

```json
{
    "folders": [
        {
            "path": "packages/tsurlfilter",
        },
        {
            "path": "packages/tswebextension",
        },
        {
            "path": "packages/agtree",
        },
        {
            "path": "packages/css-tokenizer",
        },
        {
            "path": "packages/adguard-api",
        },
        {
            "path": "packages/examples/adguard-api",
        },
        {
            "path": "packages/examples/tswebextension-mv2",
        },
        {
            "path": "packages/examples/tswebextension-mv3",
        }
    ],
    "settings": {
        "jest.runMode": "on-demand",
        "jest.enable": true,
    }
}
```

[jestplugin]: https://marketplace.visualstudio.com/items?itemName=Orta.vscode-jest
