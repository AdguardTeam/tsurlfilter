import js from '@eslint/js';
import stylistic from '@stylistic/eslint-plugin';
import jsdoc from 'eslint-plugin-jsdoc';
import simpleImportSort from 'eslint-plugin-simple-import-sort';
import tseslint from 'typescript-eslint';

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
        },
        rules: {
            'jsdoc/multiline-blocks': ['error', { noSingleLineBlocks: true }],
            'jsdoc/require-param-type': 'off',
            'jsdoc/require-returns-type': 'off',
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
            'simple-import-sort/imports': 'error',
            'simple-import-sort/exports': 'error',
            '@stylistic/brace-style': ['error', '1tbs', { allowSingleLine: true }],
            '@stylistic/arrow-parens': ['error', 'always'],
        },
    },
    {
        ignores: [
            'node_modules/',
            'dist/',
            'coverage/',
            'test/smoke/esm',
            'test/smoke/exports',
        ],
    },
];
