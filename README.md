# Extensions libraries

[![badge-open-issues]][open-issues] [![badge-closed-issues]][closed-issues] [![badge-license]][license-url]

This mono-repository contains a collection of TypeScript libraries which are used
in AdGuard browser extensions and other projects.

[badge-closed-issues]: https://img.shields.io/github/issues-closed/AdguardTeam/tsurlfilter
[badge-license]: https://img.shields.io/github/license/AdguardTeam/tsurlfilter
[badge-open-issues]: https://img.shields.io/github/issues/AdguardTeam/tsurlfilter
[closed-issues]: https://github.com/AdguardTeam/tsurlfilter/issues?q=is%3Aissue+is%3Aclosed
[license-url]: https://github.com/AdguardTeam/tsurlfilter/blob/master/LICENSE
[open-issues]: https://github.com/AdguardTeam/tsurlfilter/issues

## Packages

The following packages are available in this repository:

| Package Name                                   | Description                                                                          |
|------------------------------------------------|--------------------------------------------------------------------------------------|
| [`css-tokenizer`][csstokenizerreadme]          | A fast, spec-compliant CSS tokenizer for standard and Extended CSS.                  |
| [`agtree`][agtreereadme]                       | Universal adblock filter list parser which produces a detailed AST.                  |
| [`tsurlfilter`][tsurlfilterreadme]             | A library that enforces AdGuard's blocking rules logic.                              |
| [`tswebextension`][tswebextensionreadme]       | Wraps the web extension API for use with [`tsurlfilter`][tsurlfilterreadme].         |
| [`adguard-api`][adguardapireadme]              | Manages filter lists and ad filtering via [`tswebextension`][tswebextensionreadme].  |
| [`examples/manifest-v2`][manifestv2]           | Example using Manifest V2.                                                           |
| [`examples/manifest-v3`][manifestv3]           | Example using Manifest V3.                                                           |
| [`examples/tswebextension-example`][tswebextensionexample] | Example for [`tswebextension`][tswebextensionreadme].                    |
| [`examples/tswebextension-mv3`][tswebextensionmv3] | Example for [`tswebextension`][tswebextensionreadme] using Manifest V3.          |

Detailed information on each package is available in the [`./packages`][packages-dir] directory.

[adguardapireadme]: /packages/adguard-api/README.md
[agtreereadme]: /packages/agtree/README.md
[csstokenizerreadme]: /packages/css-tokenizer/README.md
[manifestv2]: /packages/examples/manifest-v2
[manifestv3]: /packages/examples/manifest-v3
[packages-dir]: /packages
[tsurlfilterreadme]: /packages/tsurlfilter/README.md
[tswebextensionexample]: /packages/examples/tswebextension-example
[tswebextensionmv3]: /packages/examples/tswebextension-mv3
[tswebextensionreadme]: /packages/tswebextension/README.md

## Development

### Prerequisites

Ensure that the following software is installed on your computer:

- [Node.js][nodejs], we recommend using the latest LTS version via [nvm][nvm]
- [pnpm][pnpm] for package management
- [Git][git] for version control

> [!NOTE]  
> For development, our team uses macOS and Linux. It may be possible that some commands not work on Windows,
> so if you are using Windows, we recommend using WSL or a virtual machine.

[git]: https://git-scm.com/
[nodejs]: https://nodejs.org/en/download
[nvm]: https://github.com/nvm-sh/nvm
[pnpm]: https://pnpm.io/installation

### Environment Setup

Install dependencies with pnpm: `pnpm install`.

> [!NOTE]  
> pnpm currently doesn't support installing per package dev dependencies (see https://github.com/pnpm/pnpm/issues/6300).

> [!NOTE]  
> If you want to use another linked packages in monorepo workspace, link it in root folder.

This repository uses pnpm workspaces and [Lerna][lerna] to manage multiple packages in a single repository.

[lerna]: https://lerna.js.org/

### Development Commands

- Runs tests in all packages: `npx lerna run test`
- Lint all packages: `pnpm lint`
- Remove `node_modules` from all packages and root package: `pnpm clean`
- Builds the packages in the current repo: `npx lerna run build`
- Builds a specific package: `npx lerna run build --scope=<package-name>`
  - For example, to build the `tswebextension` package: `npx lerna run build --scope=@adguard/tswebextension`.
    This command also builds `@adguard/tsurlfilter` first as it is required for `@adguard/tswebextension`.

> [!NOTE]
> You can find Lerna commands in the following link: [Lerna Commands][lernacommands].

[lernacommands]: https://lerna.js.org/docs/api-reference/commands

### Linking packages from this monorepo to another projects

`pnpm` has a nested structure for packages, which is not compatible with the classic `yarn`, because `yarn` using a flat
structure, but you can force `pnpm` to use a flat structure too by setting the `--shamefully-hoist` flag.

For example, if you want to link the `tswebextension` package from this monorepo to the
[browser extension project][browser-extension] which are using `yarn`, you can follow these steps:

1. Install packages in this monorepo with `pnpm install --shamefully-hoist`.
1. Go to the *tswebextension* package directory: `cd packages/tswebextension`, and run `yarn link`.
1. Go to the *browser extension* project directory: `cd /path/to/browser-extension`,
   and run `yarn link @adguard/tswebextension`.
   This way, the browser extension project will use the linked package from this monorepo, instead of the published one
   from the npm registry.

If the other project are using `pnpm`, you can use [`pnpm link`][pnpm-link] to connect the packages locally.
For more details, please check the pnpm documentation.

[browser-extension]: https://github.com/AdguardTeam/AdguardBrowserExtension
[pnpm-link]: https://pnpm.io/cli/link

### Sample extensions

Source code of sample extensions can be found in [`./packages/examples`][examples] directory.

You can build them using the following commands:

- MV2 sample extension: `npx lerna run build --scope tswebextension-mv2`
- MV3 sample extension: `npx lerna run build --scope tswebextension-mv3`
- AdGuard API example: `npx lerna run build --scope adguard-api-example`

To test if this extension works correctly you can use the following test pages:

Test pages:

- [Simple rules test][testcasessimplerules]
- [Script rules test][testcasesscriptrules]

[examples]: /packages/examples
[testcasesscriptrules]: https://testcases.agrd.dev/Filters/script-rules/test-script-rules.html
[testcasessimplerules]: https://testcases.agrd.dev/Filters/simple-rules/test-simple-rules.html

### VSCode Workspace

If you're using Visual Studio Code for development, it may be easier to work with the monorepo
if you use the workspace functionality.
To do this, create a `tsurlfilter.code-workspace` file in the monorepo root directory.

`jest.runMode` and `jest.enable` would be useful to those that use [Jest][jestplugin] plugin.

```json
{
    "folders": [
        { "path": "packages/tsurlfilter" },
        { "path": "packages/tswebextension" },
        { "path": "packages/agtree" },
        { "path": "packages/css-tokenizer" },
        { "path": "packages/adguard-api" },
        { "path": "packages/examples/adguard-api" },
        { "path": "packages/examples/tswebextension-mv2" },
        { "path": "packages/examples/tswebextension-mv3" }
    ],
    "settings": {
        "jest.runMode": "on-demand",
        "jest.enable": true
    }
}
```

[jestplugin]: https://marketplace.visualstudio.com/items?itemName=Orta.vscode-jest
