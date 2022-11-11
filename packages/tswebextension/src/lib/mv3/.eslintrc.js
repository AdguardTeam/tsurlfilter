module.exports = {
    rules: {
        'import/order': [
            'error',
            {
                groups: [
                    "builtin",
                    "external",
                    "internal",
                    "parent",
                    "index",
                ],
                'newlines-between': 'always',
                warnOnUnassignedImports: false,
            },
        ],

        'jsdoc/require-jsdoc': [
            'warn',
            {
                contexts: [
                    'ClassDeclaration',
                    'ClassProperty',
                    'FunctionDeclaration',
                    'MethodDefinition'
                ]
            }
        ],
        'jsdoc/require-description': [
            'warn',
            {
                contexts: [
                    'ClassDeclaration',
                    'ClassProperty',
                    'FunctionDeclaration',
                    'MethodDefinition'
                ]
            }
        ],

        'jsdoc/require-description-complete-sentence': ['warn'],

        '@typescript-eslint/explicit-function-return-type': 'error',
    }
}
