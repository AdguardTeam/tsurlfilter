import resolve from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';
import globals from 'rollup-plugin-node-globals';
import camelCase from 'lodash/camelCase';
import typescript from '@rollup/plugin-typescript';
import json from '@rollup/plugin-json';
import nodePolyfills from 'rollup-plugin-polyfill-node';
import cleanup from 'rollup-plugin-cleanup';
import { terser } from 'rollup-plugin-terser';

const DEFAULT_OUTPUT_PATH = 'dist';

const OUTPUT_PATH = process.env.PACKAGE_OUTPUT_PATH ? `${process.env.PACKAGE_OUTPUT_PATH}/dist` : DEFAULT_OUTPUT_PATH;

const libraryName = 'TSUrlFilter';
const contentScriptLibraryName = 'TSUrlFilterContentScript';

const contentScriptConfig = {
    input: 'src/content-script/index.ts',
    output: [
        {
            file: `${OUTPUT_PATH}/${contentScriptLibraryName}.js`,
            format: 'esm',
            sourcemap: false,
        },
        {
            file: `${OUTPUT_PATH}/${contentScriptLibraryName}.umd.js`,
            name: contentScriptLibraryName,
            format: 'umd',
            sourcemap: false,
        },
    ],
    watch: {
        include: 'src/**',
    },
    plugins: [
        typescript(),
        commonjs({
            sourceMap: false,
        }),
        resolve(),
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
        'src/rules/cosmetic-rule-marker.ts',
        'src/rules/network-rule-options.ts',
    ],
    output: [
        {
            dir: `${OUTPUT_PATH}/es`,
            format: 'esm',
            sourcemap: false,
        },
    ],
    watch: {
        include: 'src/**',
    },
    plugins: [
        json(),
        typescript(),
        commonjs({
            namedExports: {
                lru_map: ['LRUMap'],
            },
            sourceMap: false,
        }),
        globals(),
        nodePolyfills(),
        resolve({ preferBuiltins: false }),
        cleanup({
            comments: ['srcmaps'],
        }),
    ],
};

const browserConfig = {
    input: 'src/index.browser.ts',
    output: [
        {
            file: `${OUTPUT_PATH}/tsurlfilter.browser.js`,
            name: camelCase(libraryName),
            format: 'umd',
            sourcemap: false,
        },
        {
            file: `${OUTPUT_PATH}/tsurlfilter.iife.js`,
            name: libraryName,
            format: 'iife',
            sourcemap: false,
        },
    ],
    watch: {
        include: 'src/**',
    },
    plugins: [
        json(),
        typescript(),
        commonjs({
            namedExports: {
                lru_map: ['LRUMap'],
            },
            sourceMap: false,
        }),
        globals(),
        nodePolyfills(),
        resolve({ preferBuiltins: false }),
        cleanup({
            comments: ['srcmaps'],
        }),
    ],
};

export default [
    contentScriptConfig,
    esmConfig,
    browserConfig,
    {
        input: 'src/index.ts',
        output: [
            {
                file: `${OUTPUT_PATH}/tsurlfilter.umd.js`,
                name: camelCase(libraryName),
                format: 'umd',
                sourcemap: false,
            },
            {
                file: `${OUTPUT_PATH}/tsurlfilter.umd.min.js`,
                name: camelCase(libraryName),
                format: 'umd',
                sourcemap: false,
                plugins: [terser()],
            },
        ],
        // Indicate here external modules you don't wanna include in your bundle (i.e.: 'lodash')
        external: [],
        watch: {
            include: 'src/**',
        },
        plugins: [
            // Allow json resolution
            json(),

            // Compile TypeScript files
            typescript(),

            // Allow bundling cjs modules (unlike webpack, rollup doesn't understand cjs)
            commonjs({
                namedExports: {
                    lru_map: ['LRUMap'],
                },
                sourceMap: false,
            }),
            globals(),
            nodePolyfills(),

            // Allow node_modules resolution, so you can use 'external' to control
            // which external modules to include in the bundle
            // https://github.com/rollup/rollup-plugin-node-resolve#usage
            resolve({ preferBuiltins: false }),

            cleanup({
                comments: ['srcmaps'],
            }),
        ],
    },
];
