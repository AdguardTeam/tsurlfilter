import js from '@eslint/js';
import stylistic from '@stylistic/eslint-plugin';
import importNewlines from 'eslint-plugin-import-newlines';
import jsdoc from 'eslint-plugin-jsdoc';
import simpleImportSort from 'eslint-plugin-simple-import-sort';
import tseslint from 'typescript-eslint';

const MAX_LINE_LENGTH = 120;

export default [
    js.configs.recommended,
    ...tseslint.configs.recommended,
    stylistic.configs.customize({
        indent: 4,
        quotes: 'single',
        semi: true,
        jsx: false,
    }),
    jsdoc.configs['flat/recommended'],
    {
        plugins: {
            jsdoc,
            'simple-import-sort': simpleImportSort,
            'import-newlines': importNewlines,
        },
        rules: {
            'max-len': ['error', {
                code: MAX_LINE_LENGTH,
                comments: MAX_LINE_LENGTH,
                tabWidth: 4,
                ignoreUrls: true,
                ignoreTrailingComments: false,
                ignoreComments: false,
            }],
            'jsdoc/multiline-blocks': ['error', {
                noSingleLineBlocks: true,
                singleLineTags: [
                    'inheritdoc',
                ],
            }],
            'jsdoc/require-param-type': 'off',
            'jsdoc/require-returns-type': 'off',
            'jsdoc/require-returns': ['error'],
            'jsdoc/tag-lines': [
                'error',
                'any',
                {
                    startLines: 1,
                },
            ],
            'jsdoc/check-tag-names': [
                'error',
                {
                    // Define additional tags
                    // https://github.com/gajus/eslint-plugin-jsdoc/blob/main/docs/rules/check-tag-names.md#definedtags
                    definedTags: ['note'],
                },
            ],
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
            'jsdoc/sort-tags': ['error', {
                linesBetween: 1,
                tagSequence: [
                    {
                        tags: ['file'],
                    },
                    {
                        tags: ['template'],
                    },
                    {
                        tags: ['see'],
                    },
                    {
                        tags: ['param'],
                    },
                    {
                        tags: ['returns'],
                    },
                    {
                        tags: ['throws'],
                    },
                    {
                        tags: ['example'],
                    },
                ],
            }],
            'simple-import-sort/imports': 'error',
            'simple-import-sort/exports': 'error',
            '@stylistic/brace-style': ['error', '1tbs', { allowSingleLine: true }],
            '@stylistic/arrow-parens': ['error', 'always'],
            '@stylistic/member-delimiter-style': 'error',
            'import-newlines/enforce': ['error', {
                'items': 3,
                'max-len': MAX_LINE_LENGTH,
            }],
        },
    },
    {
        ignores: [
            'node_modules/',
            'dist/',
            'coverage/',
            'test/smoke/esm',
            'test/smoke/exports',
            'test/tasks/local-scripts/*-expected.js',
        ],
    },
];
