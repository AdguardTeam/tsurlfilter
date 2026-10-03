module.exports = {
    root: true,
    extends: ['airbnb-base', 'airbnb-typescript/base'],
    plugins: ['@typescript-eslint'],
    parser: '@typescript-eslint/parser',
    parserOptions: {
        sourceType: 'module',
        tsconfigRootDir: __dirname,
        project: ['./tsconfig.eslint.json'],
    },
    rules: {
        'no-console': 'off',
        indent: ['error', 4],
        '@typescript-eslint/indent': ['error', 4],
        'import/prefer-default-export': 'off',
        'import/no-extraneous-dependencies': 'off',
    },
    ignorePatterns: ['dist/'],
};
