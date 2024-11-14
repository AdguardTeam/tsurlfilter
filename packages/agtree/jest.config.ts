import type { Config } from 'jest';

const config: Config = {
    testEnvironment: 'node',
    testTimeout: 30000,
    testMatch: ['**/test/**/*.test.ts'],
    transform: {
        '.ts': '@swc/jest',
    },
    setupFilesAfterEnv: [
        './test/matchers/index.ts',
    ],
    coveragePathIgnorePatterns: [
        './test/helpers/',
        './test/matchers/',
    ],
    modulePathIgnorePatterns: [
        '<rootDir>/.rollup.cache/',
    ],
    extensionsToTreatAsEsm: ['.ts'],
};

export default config;
