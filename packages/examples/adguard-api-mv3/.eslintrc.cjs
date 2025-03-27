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
        'jsdoc/require-param-type': 0,
        'jsdoc/require-returns-type': 0,
        'no-bitwise': 'off',
        'no-new': 'off',
        'max-len': ['error', { code: 120, ignoreUrls: true }],
        'import-newlines/enforce': ['error', 3, 120],
        'import/prefer-default-export': 'off',
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
