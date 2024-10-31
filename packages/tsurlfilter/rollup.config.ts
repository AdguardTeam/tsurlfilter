import resolve from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';
import nodePolyfills from 'rollup-plugin-polyfill-node';
import camelCase from 'lodash/camelCase';
import typescript from '@rollup/plugin-typescript';
import json from '@rollup/plugin-json';
import cleanup from 'rollup-plugin-cleanup';
import terser from '@rollup/plugin-terser';
import { preserveShebangs } from 'rollup-plugin-preserve-shebangs';
// import { builtinModules } from 'module';

const DEFAULT_OUTPUT_PATH = 'dist';

const OUTPUT_PATH = process.env.PACKAGE_OUTPUT_PATH
    ? `${process.env.PACKAGE_OUTPUT_PATH}/dist`
    : DEFAULT_OUTPUT_PATH;

const libraryName = 'TSUrlFilter';

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
    'tslib', // Ensure tslib is included only once
];

const externalFunction = (id: string): boolean => {
    if (typeof id !== 'string') {
        return false;
    }
    return (
        /node_modules/.test(id)
        || externalPackages.some((pkg) => id === pkg || id.startsWith(`${pkg}/`))
        // || builtinModules.includes(id)
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

        // Allow bundling cjs modules (unlike webpack, rollup doesn't understand cjs)
        commonjs({
            sourceMap: false,
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

const esmConfig = {
    input: [
        'src/index.ts',
        'src/request-type.ts',
        'src/rules/simple-regex.ts',
        'src/rules/network-rule-options.ts',
    ],
    output: [
        {
            dir: `${OUTPUT_PATH}/es`,
            format: 'esm',
            sourcemap: false,
        },
    ],
    external: externalFunction,
    ...commonConfig,
};

/**
 * Declarative converter should be built separately
 * because it has some regexp which are not supported in Safari browser
 * so it throws an error in safari-web-extension. AG-21568
 */
const esmDeclarativeConverterConfig = {
    input: 'src/rules/declarative-converter/index.ts',
    output: [
        {
            file: `${OUTPUT_PATH}/es/declarative-converter.js`,
            format: 'esm',
            sourcemap: false,
        },
    ],
    external: externalFunction,
    ...commonConfig,
};
;

const cliConfig = {
    input: 'cli/index.ts',
    output: [
        {
            file: `${OUTPUT_PATH}/cli.js`,
            format: 'cjs',
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

        // Allow bundling cjs modules (unlike webpack, rollup doesn't understand cjs)
        commonjs({
            sourceMap: false,
        }),

        // Allow node_modules resolution, so you can use 'external' to control
        // which external modules to include in the bundle
        // https://github.com/rollup/rollup-plugin-node-resolve#usage
        resolve({ preferBuiltins: false }),

        cleanup({
            comments: ['srcmaps'],
        }),

        preserveShebangs(),
    ],

    watch: {
        include: 'cli/**',
    },
};

export default [
    esmConfig,
    esmDeclarativeConverterConfig,
    cliConfig,
];
