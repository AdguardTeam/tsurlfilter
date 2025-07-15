# Contributing

You can contribute to the project by opening a pull request. People who contribute to AdGuard projects can receive
various rewards, see [this page][contribute] for details.

## Development & Contribution

Here is a guide on how to set up the development environment and how to submit your changes:

- Pre-requisites: [Node.js][nodejs] (v14 or higher), [pnpm], [Git][git]. It is important to use
  Pnpm and not NPM, because the project is optimized for Pnpm.
- Fork the repository on GitHub. You will need to have a GitHub account for this. If you already have a fork, make sure
  to update it with the latest changes from the main repository.
- Clone *your forked repository* to your local machine with `git clone <repository-url>`. It is important to clone your
  forked repository and not the main repository, because you will not be able to push your changes to the main
  repository, since you do not have the permissions to do so.
- Install dependencies by following [this guide][main-dev-guide].
- Create a new branch with `git checkout -b <branch-name>`. Example: `git checkout -b feature/add-some-feature`. Please
  add `feature/` or `fix/` prefix to your branch name, and refer to the issue number if there is one. Example: `fix/42`.
- Open the **project root** folder in your editor.
- Make your changes and test them.
- Check code by running `pnpm lint:types`, `pnpm lint` and `pnpm test` commands (Husky will run these commands
  automatically before each commit).
- If everything is OK, commit your changes and push them to your forked repository. Example:
    - Add files to commit with `git add .`
    - Commit files with `git commit -m "Add some feature"`
    - Push changes to your forked repository with
    `git push origin feature/add-some-feature`.
- When you are ready to submit your changes, go to your forked repository on GitHub and create a pull request. Make sure
  to select the correct branch. Example: `feature/add-some-feature` branch in your forked repository to `master` branch
  in the main repository.
- After you open a pull request, GitHub Actions will run the tests on your changes. If the tests fail, you can see the
  error details in the "Checks" tab. If the tests pass, a green checkmark will appear in the "Checks" tab.
- Finally, wait for the maintainers to review your changes. If there are any issues, you can fix them by pushing new
  commits to your branch. If everything is OK, the maintainers will merge your pull request.

We would be happy to review your pull request and merge it if it is suitable for the project.

### Available commands

During development, you can use the following commands (listed in `package.json`):

- `pnpm build` - builds the library with [rollup][rollup] to the `dist` folder
- `pnpm build-txt` - creates a `dist/build.txt` file which contains the version of the library.
- `pnpm build-types` - build type definitions with [TypeScript][typescript] to the `dist/types` folder.
- `pnpm build-compatibility-tables` - build compatibility tables to `dist/compatibility-tables.json` file.
  This is a transformed data structure that is used by the library.
- `build-compatibility-tables-wiki` - build compatibility tables to Markdown files in the `wiki` folder.
- `pnpm lint:types` - check type definitions with [TypeScript][typescript].
- `pnpm clean` - remove the `dist` folder.
- `pnpm clean-types` - remove the `dist/types` folder.
- `pnpm coverage` - run tests with [Vitest][vitest] and generate a code coverage report.
- `pnpm increment` - increment the version of the library in `package.json` (patch version by default).
- `pnpm lint` - run all linters.
- `pnpm lint:code` - lint the code with [ESLint][eslint].
- `pnpm lint:types` - lint the type definitions with [TypeScript][typescript].
- `pnpm lint:md` - lint the markdown files with [markdownlint][markdownlint].
- `pnpm precommit` - run all checks before committing.
- `pnpm test` - run tests with [Vitest][vitest].

[contribute]: https://adguard.com/contribute.html
[eslint]: https://eslint.org/
[git]: https://git-scm.com/
[vitest]: https://vitest.dev
[main-dev-guide]: https://github.com/AdguardTeam/tsurlfilter#development
[markdownlint]: markdownlint
[nodejs]: https://nodejs.org/en/
[rollup]: https://rollupjs.org/
[typescript]: https://www.typescriptlang.org/
[pnpm]: https://pnpm.io/
