module.exports = {
    plugins: [
        'import',
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
                alphabetize: { order: 'asc', caseInsensitive: true },
                'newlines-between': 'always',
                warnOnUnassignedImports: false,
            },
        ],
    },
};
