# @adguard/eslint-plugin-logger-context

A minimal ESLint plugin for AdGuard projects that requires logger calls to start with a context tag.

## Install

```bash
pnpm add -D @adguard/eslint-plugin-logger-context
```

## Quick Start

Add to your `.eslintrc.js`:

```js
module.exports = {
  plugins: [
    '@adguard/eslint-plugin-logger-context',
  ],
  rules: {
    '@adguard/eslint-plugin-logger-context/require-logger-context': 'error',
  },
};
```

**Example of correct usage:**
```js
logger.info('[ext.page-handler]: some message');
```
