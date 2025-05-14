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
| [`adguard-api-mv3`][adguardapimv3readme]       | MV3 compatible version of [`adguard-api`][adguardapireadme].                         |
| [`dnr-rulesets`][dnrrulesetsreadme]            | Utility to load prebuilt AdGuard DNR rulesets for mv3 extensions.                    |
| [`examples/manifest-v2`][manifestv2]           | Example using Manifest V2.                                                           |
| [`examples/manifest-v3`][manifestv3]           | Example using Manifest V3.                                                           |
| [`examples/tswebextension-example`][tswebextensionexample] | Example for [`tswebextension`][tswebextensionreadme].                    |
| [`examples/tswebextension-mv3`][tswebextensionmv3] | Example for [`tswebextension`][tswebextensionreadme] using Manifest V3.          |

Detailed information on each package is available in the [`./packages`][packages-dir] directory.

[adguardapireadme]: /packages/adguard-api/README.md
[adguardapimv3readme]: /packages/adguard-api-mv3/README.md
[dnrrulesetsreadme]: /packages/dnr-rulesets/README.md
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

- [Node.js][nodejs]: v22 (you can install multiple versions using [nvm][nvm])
- [pnpm][pnpm]: v10
- [Git][git]

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
> If you want to use another linked packages in monorepo workspace, link it in root folder.

This repository uses [pnpm workspaces] and [Lerna] to manage multiple packages in a single repository.

[Lerna]: https://lerna.js.org/
[pnpm workspaces]: https://pnpm.io/workspaces

#### Catalogs

This repository also uses [pnpm catalogs] to manage dependencies.
It ensures that common dependencies have the same version for all packages,
which reduces version conflicts and simplifies dependency maintenance.

All common dependencies are listed in `pnpm-workspace.yaml`,
so if any update is needed, you should update it there.

[pnpm catalogs]: https://pnpm.io/catalogs

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

### Linking packages from this monorepo to other projects

When linking packages from this monorepo to projects that don't use pnpm, you need to be careful about package hoisting.
pnpm uses a nested node_modules structure by default, which may not be compatible with other package managers
that use flat structures.

If you need to link packages to a non-pnpm environment, you can force pnpm to use a flat structure by using the
`--shamefully-hoist` flag when installing dependencies:

```bash
pnpm install --shamefully-hoist
```

For projects using pnpm, you can use [`pnpm link`][pnpm-link] to connect the packages locally.
For more details, please check the pnpm documentation.

[pnpm-link]: https://pnpm.io/cli/link

### Notice about `zod` package versions

Within this monorepo, `zod` is utilized for data validation. There are instances where a `zod` schema is exported
from one package for use in another.
However, this can potentially lead to issues if the `zod` versions across these packages differ.
For more context, refer to [this issue][zod-issue].

To prevent this problem, the same `zod` version **must** be used across all packages in the monorepo.
That's why we use [pnpm catalogs](#catalogs).

[zod-issue]: https://github.com/colinhacks/zod/issues/2663

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
    ]
}
```
