const path = require('path');

module.exports = {
    root: true,
    parser: '@typescript-eslint/parser',
    parserOptions: {
        tsconfigRootDir: path.join(__dirname),
        project: 'tsconfig.json',
    },
    plugins: [
        'import',
        '@typescript-eslint',
        'jsdoc',
    ],
    extends: [
        'airbnb-base',
        'airbnb-typescript/base',
        'plugin:@typescript-eslint/recommended',
        'plugin:jsdoc/recommended',
    ],

    rules: {
        'indent': 'off',
        '@typescript-eslint/indent': ['error', 4, {
            SwitchCase: 1,
            ignoredNodes: ['TSTypeParameterInstantiation']
        }],
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
        '@typescript-eslint/explicit-function-return-type': 'warn',
        'arrow-body-style': 'off',
        'consistent-return': 'off',
        'no-param-reassign': 'off',

        'import/no-cycle': 'off',
        'import/export': 'off',

        // types described in ts
        'jsdoc/require-param-type': 'off',
        'jsdoc/require-returns-type': 'off',

        'jsdoc/tag-lines': 'off',
        'jsdoc/require-throws': 'error',
    },
};
