import type { Config } from 'jest';

const config: Config = {
    testEnvironment: 'node',
    testTimeout: 30000,
    testMatch: ['**/test/**/*.test.ts'],
    transform: {
        // Enable importing YAML files while testing
        '.yml': 'yaml-jest-transform',
        // Speed up tests by using SWC instead of Babel
        '.ts': '@swc/jest',
    },
    setupFilesAfterEnv: [
        // Load custom matchers automatically
        './test/matchers/index.ts',
    ],
    coveragePathIgnorePatterns: [
        // Ignore test helpers and matchers from coverage
        './test/helpers/',
        './test/matchers/',
    ],
};

export default config;
