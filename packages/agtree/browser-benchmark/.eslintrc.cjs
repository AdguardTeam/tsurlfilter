/**
 * @file ESLint configuration for the benchmark folder.
 */

module.exports = {
    extends: '../.eslintrc.cjs',
    rules: {
        'import/no-extraneous-dependencies': 'off',
        '@typescript-eslint/no-loop-func': 'off',
    },
};
