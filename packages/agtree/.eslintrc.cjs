/**
 * @file ESLint configuration based on Airbnb's with some modifications.
 */

// eslint-disable-next-line @typescript-eslint/no-var-requires
const { join } = require('path');

const MAX_LINE_LENGTH = 120;

module.exports = {
    root: true,
    extends: [
        'eslint:recommended',
        'plugin:@typescript-eslint/recommended',
        'airbnb-base',
        'airbnb-typescript/base',
        'plugin:jsdoc/recommended',
    ],
    parser: '@typescript-eslint/parser',
    parserOptions: {
        tsconfigRootDir: join(__dirname),
        project: 'tsconfig.json',
    },
    plugins: ['import', '@typescript-eslint', 'import-newlines'],
    rules: {
        'max-len': [
            'error',
            {
                code: MAX_LINE_LENGTH,
                comments: MAX_LINE_LENGTH,
                tabWidth: 4,
                ignoreUrls: true,
                ignoreTrailingComments: false,
                ignoreComments: false,
            },
        ],
        '@typescript-eslint/indent': [
            'error',
            4,
            {
                SwitchCase: 1,
            },
        ],
        'jsdoc/multiline-blocks': ['error', { noSingleLineBlocks: true }],
        'import/prefer-default-export': 'off',
        'import-newlines/enforce': ['error', { items: 3, 'max-len': MAX_LINE_LENGTH }],
        // Split external and internal imports with an empty line
        'import/order': [
            'error',
            {
                groups: [
                    ['builtin', 'external'],
                ],
                'newlines-between': 'always',
            },
        ],
        'no-restricted-syntax': ['error', 'LabeledStatement', 'WithStatement'],
        'no-continue': 'off',
        'no-new': 'off',
        'jsdoc/require-param-type': 'off',
        'jsdoc/require-returns-type': 'off',
        'jsdoc/require-jsdoc': [
            'error',
            {
                require: {
                    ClassDeclaration: true,
                },
            },
        ],
        'jsdoc/tag-lines': [
            'warn',
            'any',
            {
                startLines: 1,
            },
        ],
        'jsdoc/check-tag-names': [
            'warn',
            {
                // Define additional tags
                // https://github.com/gajus/eslint-plugin-jsdoc/blob/main/docs/rules/check-tag-names.md#definedtags
                definedTags: ['note'],
            },
        ],
        'arrow-body-style': 'off',
        '@typescript-eslint/member-delimiter-style': 'error',
        'no-await-in-loop': 'off',
        // Force proper import and export of types
        '@typescript-eslint/consistent-type-imports': [
            'error',
            {
                fixStyle: 'inline-type-imports',
            },
        ],
        '@typescript-eslint/consistent-type-exports': [
            'error',
            {
                fixMixedExportsWithInlineTypeSpecifier: true,
            },
        ],
    },
};
