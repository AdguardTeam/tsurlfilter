import type { Config } from 'jest';

const config: Config = {
    transform: {
        '.+\\.(js|ts)$': '@swc/jest',
    },
    testEnvironment: 'node',
    coverageThreshold: {
        global: {
            branches: 100,
            functions: 100,
            lines: 100,
            statements: 100,
        },
    },
};

export default config;
