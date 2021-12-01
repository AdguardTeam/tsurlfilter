const path = require('path');

module.exports = {
    root: true,
    parser: '@typescript-eslint/parser',
    parserOptions: {
        project: [path.join(__dirname, 'tsconfig.eslint.json')],
    },
    plugins: [
        'import',
        '@typescript-eslint',
    ],
    extends: [
        'eslint:recommended',
        'plugin:@typescript-eslint/eslint-recommended',
        'plugin:@typescript-eslint/recommended',
        'airbnb-typescript/base',
    ],

    rules: {
        'indent': 'off',
        '@typescript-eslint/indent': ['error', 4],
        'no-bitwise': 'off',
        'no-new': 'off',
        'max-len': ['error', { code: 120 }],
        'import/prefer-default-export': 'off',
        '@typescript-eslint/no-non-null-assertion': 'off',
        'no-continue': 'off',
        'import/no-extraneous-dependencies': ['error', { 'devDependencies': true }],
        'no-restricted-syntax': ['error', 'LabeledStatement', 'WithStatement'],
        'no-constant-condition': ['error', { 'checkLoops': false }],
        '@typescript-eslint/interface-name-prefix': 'off',
        'arrow-body-style': 'off',
    },
};
