const path = require('path');

module.exports = {
    root: true,
    parser: '@typescript-eslint/parser',
    parserOptions: {
        tsconfigRootDir: path.join(__dirname),
        project: 'tsconfig.eslint.json',
    },
    env: {
        browser: true,
    },
    extends: [
        'airbnb-base',
        'airbnb-typescript/base',
        'plugin:jsdoc/recommended',
        'plugin:prettier/recommended'
    ],
    rules: {
        'import/prefer-default-export': 0,
        'jsdoc/require-param-type': 0,
        'jsdoc/require-returns-type': 0,

    },
};
