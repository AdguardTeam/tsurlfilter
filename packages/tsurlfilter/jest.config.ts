import type { Config } from 'jest';

const config: Config = {
    transform: {
        '.ts': '@swc/jest',
    },
    testEnvironment: 'node',
    testRegex: '(/__tests__/.*|\\.(test|spec))\\.(ts|tsx|js)$',
    moduleFileExtensions: ['js', 'ts'],
    coveragePathIgnorePatterns: [
        '/node_modules/',
        '/test/',
    ],
    coverageThreshold: {
        global: {
            // TODO: improve coverage
            // branches: 90,
            // functions: 95,
            lines: 95,
            // statements: 95,
        },
    },
    collectCoverageFrom: [
        'src/*.ts',
        'src/*/*.ts',
        'src/*/*/*.ts',
    ],
};

export default config;
