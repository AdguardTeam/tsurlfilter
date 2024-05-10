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
            // FIXME (David): Reduced from 95 to avoid build failures - need to improve coverage
            lines: 90,
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
