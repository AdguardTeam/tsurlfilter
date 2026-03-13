/**
 * @file ESLint configuration for tests.
 */
module.exports = {
    rules: {
        'jsdoc/require-file-overview': 'off',
        'import/no-extraneous-dependencies': 'off',
        'import-newlines/enforce': 'off',
        'max-len': ['error', {
            code: 120,
            comments: 120,
            ignoreUrls: true,
            ignoreStrings: true,
            ignoreTemplateLiterals: true,
            ignoreRegExpLiterals: true,
        }],
        'boundaries/element-types': 'off',
    },
};
