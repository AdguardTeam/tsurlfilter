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
    '@adguard/logger-context',
  ],
  rules: {
    '@adguard/logger-context/require-logger-context': ['error', {
      // optional
      contextModuleName: 'module',
      // optional
      loggerVariableName: 'logger',
    }],
  },
};
```

**Example of correct usage:**
```js
logger.info('[module.page-handler]: some message');
```
