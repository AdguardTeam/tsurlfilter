module.exports = {
    extends: [
        'plugin:jsdoc/recommended',
    ],
    rules: {
        // types described in ts
        'jsdoc/require-param-type': 'off',
        'jsdoc/no-undefined-types': 'off',
        'jsdoc/require-returns-type': 'off',
        'jsdoc/tag-lines': 'off',
        'jsdoc/require-throws': 'error',
        'jsdoc/check-tag-names': ['error', {
            definedTags: ['jest-environment'],
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
        'jsdoc/require-description-complete-sentence': ['error'],
        'jsdoc/require-returns': ['error'],
    },
};