import type { Config } from 'jest';

const transformedModules = [
    'cidr-tools',
];

const config: Config = {
    transform: {
        '.+\\.(js|ts)$': '@swc/jest',
    },
    transformIgnorePatterns: [
        `/node_modules/(?!(${transformedModules.join('|')}))/`,
    ],
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
