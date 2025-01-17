import type { Config } from 'jest';

const config: Config = {
    transform: {
        '.+\\.(js|ts)$': '@swc/jest',
    },
    testEnvironment: 'node',
};

export default config;
