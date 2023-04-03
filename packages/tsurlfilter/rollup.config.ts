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


const commonConfig = {
    cache: false,
    watch: {
        include: 'src/**',
    },
};

const contentScriptUmdConfig = {
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
    plugins: [
        typescript(),
        resolve(),
        commonjs({
            sourceMap: false,
        }),
        cleanup({
            comments: ['srcmaps'],
        }),
    ],
    ...commonConfig,
};

/**
 * Config for building content script utils, they shouldn't have side effects
 */
const contentScriptEsmConfig = {
    input: [
        'src/content-script/css-hits-counter.ts',
        'src/content-script/index.ts',
    ],
    output: [{
        dir: 'dist/es/content-script',
        format: 'esm',
        sourcemap: false,
    }],
    plugins: [
        typescript(),
        resolve(),
        commonjs({
            sourceMap: false,
        }),
        cleanup({
            comments: ['srcmaps'],
        }),
    ],
    ...commonConfig,
};

const esmConfig = {
    input: [
        'src/index.ts',
        'src/request-type.ts',
        'src/rules/simple-regex.ts',
        'src/rules/cosmetic-rule-marker.ts',
        'src/rules/network-rule-options.ts',
        'src/cookie-filtering/cookie-filtering.ts',
        'src/headers-filtering/headers-service.ts',
        'src/stealth/stealth-service.ts',
    ],
    output: [
        {
            dir: `${OUTPUT_PATH}/es`,
            format: 'esm',
            sourcemap: false,
        },
    ],
    plugins: [
        json(),
        typescript(),
        commonjs({
            sourceMap: false,
        }),
        globals(),
        nodePolyfills(),
        resolve({ preferBuiltins: false }),
        cleanup({
            comments: ['srcmaps'],
        }),
    ],
    ...commonConfig,
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
    plugins: [
        json(),
        typescript(),
        commonjs({
            sourceMap: false,
        }),
        globals(),
        nodePolyfills(),
        resolve({ preferBuiltins: false }),
        cleanup({
            comments: ['srcmaps'],
        }),
    ],
    ...commonConfig,
};

const umdConfig = {
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
    plugins: [
        json(),
        typescript(),
        commonjs({
            sourceMap: false,
        }),
        globals(),
        nodePolyfills(),
        resolve({ preferBuiltins: false }),
        cleanup({
            comments: ['srcmaps'],
        }),
    ],
    ...commonConfig,
};

export default [
    contentScriptUmdConfig,
    contentScriptEsmConfig,
    esmConfig,
    browserConfig,
    umdConfig,
];
