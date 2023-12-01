import type { Config } from 'jest';

const transformedModules = [
    'lodash-es',
];

const config: Config = {
    transform: {
        '.+\\.(js|ts)': '@swc/jest',
    },
    transformIgnorePatterns: [
        `/node_modules/(?!(${transformedModules.join('|')}))/`,
        '.*\\.json',
    ],
    testEnvironment: 'jsdom',
    testRegex: '(/__tests__/.*|\\.(test|spec))\\.(ts|tsx|js)$',
    moduleFileExtensions: [
        'ts',
        'tsx',
        'js',
    ],
    coveragePathIgnorePatterns: [
        '/node_modules/',
        '/test/',
        '/src/index.browser.ts',
    ],
    coverageThreshold: {
        global: {
            branches: 0,
            functions: 0,
            lines: 0,
            statements: 0,
        },
    },
    collectCoverageFrom: [
        'src/**/*.{js,ts}',
    ],
    setupFiles: [
        './setupTests.ts',
    ],
    moduleNameMapper: {
        '^@lib/(.*)$': '<rootDir>/src/lib/$1',
    },
};

export default config;
