/**
 * @file Jest configuration
 */

import type { Config } from 'jest';

const config: Config = {
    testEnvironment: 'node',
    testTimeout: 30000,
    testMatch: [
        '**/test/**/*.test.ts',
    ],
    transform: {
        // Speed up tests by using SWC instead of Babel
        '.ts': '@swc/jest',
    },
    collectCoverageFrom: [
        'src/**/*.ts',
        // No need to cover the version file
        '!src/version.ts',
    ],
    // Minimum coverage thresholds
    coverageThreshold: {
        global: {
            branches: 90,
            functions: 90,
            lines: 90,
            statements: 90,
        },
    },
};

export default config;
