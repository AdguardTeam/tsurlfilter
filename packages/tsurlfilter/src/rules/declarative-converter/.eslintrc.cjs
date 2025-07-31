module.exports = {
    plugins: [
        'import',
    ],
    extends: [
        'plugin:jsdoc/recommended',
    ],
    rules: {
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
                warnOnUnassignedImports: false,
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
        'jsdoc/require-throws': 'error',
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
                abbreviations: ['e.g.'],
            },
        ],
        // types described in ts
        'jsdoc/require-param-type': 'off',
        'jsdoc/require-returns-type': 'off',
        'jsdoc/tag-lines': 'off',

        '@typescript-eslint/explicit-function-return-type': 'error',
    },
};
