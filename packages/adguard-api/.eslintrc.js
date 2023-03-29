const path = require('path');

module.exports = {
    root: true,
    parser: '@typescript-eslint/parser',
    parserOptions: {
        tsconfigRootDir: path.join(__dirname),
        project: 'tsconfig.json',
    },
    env: {
        browser: true,
    },
    extends: [
        'airbnb-base',
        'airbnb-typescript/base',
        'plugin:jsdoc/recommended',
        'plugin:prettier/recommended',
    ],
    rules: {
        '@typescript-eslint/explicit-function-return-type': 'error',
        'import/prefer-default-export': 'off',
        'jsdoc/require-param-type': 'off',
        'jsdoc/require-returns-type': 'off',
        'jsdoc/require-throws': 'error',
        'jsdoc/require-file-overview': 'error',
    },
};