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
    ],
    extends: [
        'airbnb-base',
        'airbnb-typescript/base',
        'plugin:jsdoc/recommended',
    ],
    ignorePatterns: [
        'dist',
        'coverage',
        'tests/smoke',
    ],
    rules: {
        indent: 'off',
        'arrow-body-style': 'off',
        'max-len': ['error', { code: 120, ignoreUrls: true }],
        'no-new': 'off',
        'no-continue': 'off',
        'no-restricted-syntax': ['error', 'LabeledStatement', 'WithStatement'],
        'no-constant-condition': ['error', { checkLoops: false }],
        'no-param-reassign': 'off',

        'import/prefer-default-export': 'off',
        'import/no-extraneous-dependencies': ['error', { devDependencies: true }],
        'import/no-cycle': 'off',
        'import/export': 'off',

        '@typescript-eslint/indent': ['error', 4, {
            SwitchCase: 1,
            ignoredNodes: ['TSTypeParameterInstantiation'],
        }],
        '@typescript-eslint/no-non-null-assertion': 'off',
        '@typescript-eslint/interface-name-prefix': 'off',
        '@typescript-eslint/explicit-function-return-type': 'error',
        '@typescript-eslint/member-delimiter-style': 'error',

        // types described in ts
        'jsdoc/require-param-type': 'off',
        'jsdoc/no-undefined-types': 'off',
        'jsdoc/require-returns-type': 'off',
        'jsdoc/require-throws': 'error',
        'jsdoc/check-tag-names': ['error'],
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
        'jsdoc/require-description-complete-sentence': ['error'],
        'jsdoc/require-returns': ['error'],
        'jsdoc/require-hyphen-before-param-description': ['error', 'never'],
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
