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
        'import-newlines',
        '@adguard/logger-context',
        '@typescript-eslint',
    ],
    extends: [
        'airbnb-base',
        'airbnb-typescript/base',
        'plugin:@typescript-eslint/eslint-recommended',
        'plugin:jsdoc/recommended',
    ],
    ignorePatterns: [
        'dist',
        'coverage',
    ],
    rules: {
        indent: 'off',
        '@typescript-eslint/indent': ['error', 4],
        'no-bitwise': 'off',
        'no-new': 'off',
        'max-len': ['error', {
            code: 120,
            ignoreUrls: true,
            /**
             * Ignore calls to logger, e.g. logger.error(), because of the long string.
             */
            ignorePattern: 'logger\\.',
        }],
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

        // Force proper import and export of types
        '@typescript-eslint/consistent-type-imports': [
            'error',
            {
                prefer: 'type-imports',
                fixStyle: 'inline-type-imports',
            },
        ],
        '@typescript-eslint/consistent-type-exports': [
            'error',
            {
                fixMixedExportsWithInlineTypeSpecifier: true,
            },
        ],

        // types described in ts
        'jsdoc/require-param-type': 'off',
        'jsdoc/no-undefined-types': 'off',
        'jsdoc/require-returns-type': 'off',
        'jsdoc/require-description-complete-sentence': [
            'error',
            {
                abbreviations: [
                    'e.g.',
                    'i.e.',
                ],
            },
        ],
        'jsdoc/require-hyphen-before-param-description': ['error', 'never'],
        'jsdoc/multiline-blocks': ['error', {
            noSingleLineBlocks: true,
            singleLineTags: [
                'inheritdoc',
            ],
        }],
        'jsdoc/check-tag-names': [
            'warn',
            {
                // Define additional tags
                // https://github.com/gajus/eslint-plugin-jsdoc/blob/main/docs/rules/check-tag-names.md#definedtags
                definedTags: ['note'],
            },
        ],
        'jsdoc/require-returns': ['error'],
        'jsdoc/tag-lines': [
            'error',
            'any',
            {
                startLines: 1,
            },
        ],
        'jsdoc/sort-tags': ['error', {
            linesBetween: 1,
            tagSequence: [
                { tags: ['file'] },
                { tags: ['template'] },
                { tags: ['see'] },
                { tags: ['param'] },
                { tags: ['returns'] },
                { tags: ['throws'] },
                { tags: ['example'] },
            ],
        }],

        // Check that every logger call has a context tag.
        '@adguard/logger-context/require-logger-context': ['error', {
            contextModuleName: 'tsurl',
        }],
    },
};
