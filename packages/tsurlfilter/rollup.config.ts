import resolve from '@rollup/plugin-node-resolve';
import nodePolyfills from 'rollup-plugin-polyfill-node';

import typescript from '@rollup/plugin-typescript';
import json from '@rollup/plugin-json';
import cleanup from 'rollup-plugin-cleanup';

const DEFAULT_OUTPUT_PATH = 'dist';

// FIXME: Check, if it is needed to use PACKAGE_OUTPUT_PATH?
const OUTPUT_PATH = process.env.PACKAGE_OUTPUT_PATH
    ? `${process.env.PACKAGE_OUTPUT_PATH}/${DEFAULT_OUTPUT_PATH}`
    : DEFAULT_OUTPUT_PATH;

const externalPackages = [
    '@adguard/agtree',
    '@adguard/css-tokenizer',
    '@adguard/scriptlets',
    'is-ip',
    'punycode/',
    'tldts',
    'is-cidr',
    'cidr-tools',
    'zod',
    'commander',
    'tslib',
    'module',
];

const externalFunction = (id: string): boolean => {
    if (typeof id !== 'string') {
        return false;
    }
    return (
        /node_modules/.test(id)
        || externalPackages.some((pkg) => id === pkg || id.startsWith(`${pkg}/`))
    );
};

const commonConfig = {
    cache: false,
    watch: {
        include: 'src/**',
    },
    plugins: [
        // Allow json resolution
        json(),

        // Compile TypeScript files
        typescript({
            tsconfig: 'tsconfig.build.json',
        }),

        nodePolyfills(),

        // Allow node_modules resolution, so you can use 'external' to control
        // which external modules to include in the bundle
        // https://github.com/rollup/rollup-plugin-node-resolve#usage
        resolve({ preferBuiltins: false }),

        cleanup({
            comments: ['srcmaps'],
        }),
    ],
};

const library = {
    input: [
        'src/index.ts',
        'src/configuration.ts',
        'src/engine/index.ts',
        /**
         * Separate dns-engine from the main bundle for dns-website.
         */
        'src/engine/dns-engine.ts',
        'src/filterlist/index.ts',
        'src/request/index.ts',
        'src/rules/index.ts',
        /**
         * Declarative converter should be built separately,
         * because it has some regexp which are not supported in Safari browser
         * so it throws an error in safari-web-extension. AG-21568
         */
        'src/rules/declarative-converter/index.ts',
        'src/modifiers/index.ts',
        'src/utils/index.ts',
        'src/version.ts',
    ],
    output: [
        {
            dir: OUTPUT_PATH,
            format: 'esm',
            sourcemap: false,
            preserveModules: true,
            preserveModulesRoot: 'src',
        },
    ],
    external: externalFunction,
    ...commonConfig,
};

const cli = {
    input: 'cli/index.ts',
    output: [
        {
            file: `${OUTPUT_PATH}/cli.js`,
            format: 'esm',
            sourcemap: false,
        },
    ],
    external: externalFunction,
    plugins: [
        // Allow json resolution
        json(),

        // Compile TypeScript files
        typescript({
            tsconfig: 'tsconfig.build.json',
        }),

        // Allow node_modules resolution, so you can use 'external' to control
        // which external modules to include in the bundle
        // https://github.com/rollup/rollup-plugin-node-resolve#usage
        resolve({ preferBuiltins: false }),

        cleanup({
            comments: ['srcmaps'],
        }),
    ],

    watch: {
        include: 'cli/**',
    },
};

export default [
    library,
    cli,
];
