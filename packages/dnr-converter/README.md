# DNR Converter

[![npm-badge]][npm-url] [![license-badge]][license-url]

[npm-badge]: https://img.shields.io/npm/v/@adguard/dnr-converter
[npm-url]: https://www.npmjs.com/package/@adguard/dnr-converter
[license-badge]: https://img.shields.io/npm/l/@adguard/dnr-converter
[license-url]: https://github.com/AdguardTeam/dnr-converter/blob/master/packages/dnr-converter/LICENSE

A converter that transforms adblock-style filtering rules into rules compatible with the Declarative Net Request (DNR) API.

- [Installation](#installation)
- [API description](#api-description)
    - [Public properties](#public-properties)
        - [`DNR_CONVERTER_VERSION`](#dnr-converter-version)
- [Development](#development)
    - [NPM scripts](#npm-scripts)

## <a id="usage"></a>Installation

You can install the package via:

- [PNPM][pnpm-pkg-manager-url]: `pnpm install @adguard/dnr-converter`
- [Yarn][yarn-pkg-manager-url]: `yarn add @adguard/dnr-converter`
- [NPM][npm-pkg-manager-url]: `npm install @adguard/dnr-converter`

[npm-pkg-manager-url]: https://www.npmjs.com/get-npm
[yarn-pkg-manager-url]: https://yarnpkg.com/en/docs/install
[pnpm-pkg-manager-url]: https://pnpm.io/

## <a id="api-description"></a>API description

### <a id="public-properties"></a>Public properties

#### <a id="dnr-converter-version"></a>`DNR_CONVERTER_VERSION`

type: `string`

Version of the library.

## Development

This project is part of the `@adguard/extensions` monorepo.
It is highly recommended to use `lerna` for commands as it will execute scripts in the correct order and can cache dependencies.

```sh
npx lerna run <script> --scope=@adguard/dnr-converter --include-dependencies
```

### <a id="npm-scripts"></a>NPM scripts

- `lint`: Run ESLint and TSC
- `lint:code`: Run ESLint
- `lint:types`: Run TSC
- `start` Start build in watch mode
- `build`: Build the project
- `test`: Run tests
- `test:light`: Run tests without benchmarks
- `test:watch`: Run tests in watch mode
- `test:coverage`: Run tests with coverage
- `test:smoke`: Run smoke tests
- `test:prod`: Run production tests, i.e lint, smoke tests, and tests
- `test:debug`: Run tests in debug mode
