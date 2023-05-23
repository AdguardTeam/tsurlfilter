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
        project: 'tsconfig.eslint.json',
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
        'no-restricted-syntax': ['error', 'LabeledStatement', 'WithStatement'],
        'no-continue': 'off',
        'jsdoc/require-param-type': 'off',
        'jsdoc/require-returns-type': 'off',
        'jsdoc/tag-lines': [
            'warn',
            'any',
            {
                startLines: 1,
            },
        ],
        'arrow-body-style': 'off',
        'no-await-in-loop': 'off',
    },
};
