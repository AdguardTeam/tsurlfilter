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
                'newlines-between': 'always',
                warnOnUnassignedImports: false,
            },
        ],
    },
};
