const path = require('path');

const MAX_LINE_LENGTH = 120;

module.exports = {
    root: true,
    parser: '@typescript-eslint/parser',
    parserOptions: {
        tsconfigRootDir: path.join(__dirname),
        project: [
            './tsconfig.json',
        ],
    },
    plugins: [
        'import',
        'import-newlines',
        '@adguard/logger-context',
        '@typescript-eslint',
        '@vitest',
    ],
    extends: [
        'airbnb-base',
        'airbnb-typescript/base',
        'plugin:jsdoc/recommended',
    ],
    ignorePatterns: ['dist', 'coverage'],
    rules: {
        indent: 'off',
        '@typescript-eslint/indent': ['error', 4, {
            SwitchCase: 1,
            ignoredNodes: ['TSTypeParameterInstantiation'],
        }],
        'no-bitwise': 'off',
        'no-new': 'off',
        'max-len': ['error', {
            code: MAX_LINE_LENGTH,
            comments: MAX_LINE_LENGTH,
            tabWidth: 4,
            ignoreUrls: true,
            ignoreTrailingComments: false,
            ignoreComments: false,
            /*
             * Ignore calls to logger, e.g. logger.error(), because of the long string.
             */
            ignorePattern: 'logger\\.',
        }],
        'import/prefer-default-export': 'off',
        '@typescript-eslint/no-non-null-assertion': 'off',
        'no-continue': 'off',
        'import/no-extraneous-dependencies': ['error', { devDependencies: true }],
        'no-restricted-syntax': ['error', 'LabeledStatement', 'WithStatement'],
        'no-constant-condition': ['error', { checkLoops: false }],
        '@typescript-eslint/interface-name-prefix': 'off',
        '@typescript-eslint/explicit-function-return-type': 'error',
        '@typescript-eslint/member-delimiter-style': 'error',
        'arrow-body-style': 'off',
        'no-param-reassign': 'off',
        'import/no-cycle': 'off',
        'import/export': 'off',
        'import-newlines/enforce': ['error', {
            items: 3,
            'max-len': MAX_LINE_LENGTH,
        }],
        'import/order': [
            'error',
            {
                groups: [
                    'builtin',
                    'external',
                    'internal',
                    'parent',
                    'index',
                ],
                'newlines-between': 'always',
            },
        ],

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
        'jsdoc/require-throws': 'error',
        'jsdoc/check-tag-names': ['error', {
            definedTags: ['vitest-environment', 'note'],
        }],
        'jsdoc/require-jsdoc': [
            'error',
            {
                contexts: [
                    'ClassDeclaration',
                    'ClassProperty',
                    'FunctionDeclaration',
                    'MethodDefinition',
                ],
            },
        ],
        'jsdoc/require-description': [
            'error',
            {
                contexts: [
                    'ClassDeclaration',
                    'ClassProperty',
                    'FunctionDeclaration',
                    'MethodDefinition',
                ],
            },
        ],
        'jsdoc/require-description-complete-sentence': [
            'error',
            {
                abbreviations: [
                    'e.g.',
                    'i.e.',
                ],
            },
        ],
        'jsdoc/require-returns': ['error'],
        'jsdoc/no-defaults': 'off',
        'jsdoc/multiline-blocks': ['error', {
            noSingleLineBlocks: true,
            singleLineTags: [
                'inheritdoc',
            ],
        }],
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
            contextModuleName: 'tsweb',
        }],
    },
};
