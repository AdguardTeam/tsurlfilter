import resolve from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';
import nodePolyfills from 'rollup-plugin-polyfill-node';
import { nodeExternals } from 'rollup-plugin-node-externals';

import typescript from '@rollup/plugin-typescript';
import json from '@rollup/plugin-json';
import cleanup from 'rollup-plugin-cleanup';

const DEFAULT_OUTPUT_PATH = 'dist';

const OUTPUT_PATH = process.env.PACKAGE_OUTPUT_PATH
    ? `${process.env.PACKAGE_OUTPUT_PATH}/${DEFAULT_OUTPUT_PATH}`
    : DEFAULT_OUTPUT_PATH;

const commonConfig = {
    cache: false,
    watch: {
        include: 'src/**',
    },
    plugins: [
        nodeExternals(),

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
    ...commonConfig,
};

/**
 * Declarative converter should be built separately
 * because it has some regexp which are not supported in Safari browser
 * so it throws an error in safari-web-extension. AG-21568.
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
    ...commonConfig,
};

const esmDeclarativeConverterUtilsConfig = {
    input: 'src/rules/declarative-converter-utils/index.ts',
    output: [
        {
            file: `${OUTPUT_PATH}/es/declarative-converter-utils.js`,
            format: 'esm',
            sourcemap: false,
        },
    ],
    ...commonConfig,
};

const cliConfig = {
    input: 'cli/index.ts',
    output: [
        {
            file: `${OUTPUT_PATH}/cli.js`,
            format: 'esm',
            sourcemap: false,
            banner: '#!/usr/bin/env node',
        },
    ],
    plugins: [
        nodeExternals(),

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
    esmConfig,
    esmDeclarativeConverterConfig,
    esmDeclarativeConverterUtilsConfig,
    cliConfig,
];
