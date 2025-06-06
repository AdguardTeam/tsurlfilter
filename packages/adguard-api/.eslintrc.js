/* eslint-disable jsdoc/require-file-overview */
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
    plugins: [
        'import',
        'import-newlines',
    ],
    extends: [
        'airbnb-base',
        'airbnb-typescript/base',
        'plugin:jsdoc/recommended',
        'plugin:@typescript-eslint/eslint-recommended',
    ],
    rules: {
        indent: 'off',
        '@typescript-eslint/indent': ['error', 4],
        'no-bitwise': 'off',
        'no-new': 'off',
        'max-len': ['error', { code: 120, ignoreUrls: true }],
        'import-newlines/enforce': ['error', 3, 120],
        'import/prefer-default-export': 'off',
        'jsdoc/require-param-type': 'off',
        'jsdoc/require-returns-type': 'off',
        'jsdoc/no-undefined-types': 'off',
        // TODO: enable and fix src
        'jsdoc/tag-lines': 'off',
        'jsdoc/require-throws': 'error',
        'jsdoc/require-file-overview': 'error',
        '@typescript-eslint/no-non-null-assertion': 'off',
        'no-continue': 'off',
        'import/no-extraneous-dependencies': ['error', { devDependencies: true }],
        'no-restricted-syntax': ['error', 'LabeledStatement', 'WithStatement'],
        'no-constant-condition': ['error', { checkLoops: false }],
        '@typescript-eslint/interface-name-prefix': 'off',
        '@typescript-eslint/member-delimiter-style': 'error',
        'arrow-body-style': 'off',
    },
};
