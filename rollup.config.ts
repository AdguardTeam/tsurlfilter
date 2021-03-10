import resolve from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';
import sourceMaps from 'rollup-plugin-sourcemaps';
import globals from 'rollup-plugin-node-globals';
import camelCase from 'lodash/camelCase';
import typescript from '@rollup/plugin-typescript';
import json from '@rollup/plugin-json';
import pkg from './package.json';

const libraryName = 'TSUrlFilter';
const contentScriptLibraryName = 'TSUrlFilterContentScript';

const contentScriptConfig = {
    input: 'src/content-script/index.ts',
    output: [
        {
            file: `dist/${contentScriptLibraryName}.js`,
            format: 'esm',
            sourcemap: false,
        },
        {
            file: `dist/${contentScriptLibraryName}.umd.js`,
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
        commonjs(),
        resolve(),
        sourceMaps(),
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
            dir: 'dist/es',
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
        commonjs(),
        globals(),
        resolve({ preferBuiltins: false }),
        sourceMaps(),
    ],
};

const browserConfig = {
    input: 'src/index.browser.ts',
    output: [
        {
            file: pkg.browser,
            name: camelCase(libraryName),
            format: 'umd',
            sourcemap: false,
        },
        {
            file: pkg.iife,
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
        commonjs(),
        globals(),
        resolve({ preferBuiltins: false }),
        sourceMaps(),
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
                file: pkg.main,
                name: camelCase(libraryName),
                format: 'umd',
                sourcemap: false,
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
            commonjs(),
            globals(),

            // Allow node_modules resolution, so you can use 'external' to control
            // which external modules to include in the bundle
            // https://github.com/rollup/rollup-plugin-node-resolve#usage
            resolve({ preferBuiltins: false }),

            // Resolve source maps to the original source
            sourceMaps(),
        ],
    },
];
