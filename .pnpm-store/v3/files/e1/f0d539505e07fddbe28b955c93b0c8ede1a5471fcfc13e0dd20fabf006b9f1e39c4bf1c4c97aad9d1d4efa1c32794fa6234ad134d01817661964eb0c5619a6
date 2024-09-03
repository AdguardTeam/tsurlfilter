# rollup-plugin-preserve-shebangs

> A Rollup plugin that preserves shebangs (#!/usr/bin/env node) in output files

## Why?

Package executables (under `bin` in package.json) need _shebang_ `#!/usr/bin/env node` at the top of the file.

With that line, rollup errors:

```
Error: Unexpected character '#'
```

This plugin removes the shebang before compilation, and restores it before writing the file.

## Install

```
npm i -D rollup-plugin-preserve-shebangs
# or, with yarn
yarn add -D rollup-plugin-preserve-shebangs
```

## Usage

```js
// rollup.config.js

const { preserveShebangs } = require('rollup-plugin-preserve-shebangs');

module.exports = {
  // ...
  plugins: [
    // ...
    preserveShebangs(),
  ],
};
```
