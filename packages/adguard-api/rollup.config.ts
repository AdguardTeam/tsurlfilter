/* eslint-disable jsdoc/require-file-overview */
import swc from '@rollup/plugin-swc';
import resolve from '@rollup/plugin-node-resolve';
import json from '@rollup/plugin-json';

const OUTPUT_PATH = 'dist';

const cache = true;

const plugins = [
    swc({
        swc: {
            jsc: {
                parser: {
                    syntax: 'typescript',
                },
                target: 'esnext',
            },
        },
    }),
    // Allow node_modules resolution, so you can use 'external' to control
    // which external modules to include in the bundle
    // https://github.com/rollup/rollup-plugin-node-resolve#usage
    resolve({
        preferBuiltins: false,
        extensions: ['.js', '.ts'],
    }),
];

const backgroundConfig = {
    cache,
    input: ['src/background/index.ts'],
    output: [
        {
            file: `${OUTPUT_PATH}/adguard-api.js`,
            format: 'esm',
            sourcemap: true,
        },
    ],
    watch: {
        include: 'src/background/**',
    },
    external: [
        '@adguard/tswebextension',
        '@adguard/filters-downloader/browser',
        'webextension-polyfill',
        'zod',
    ],
    plugins: [
        json(),
        ...plugins,
    ],
};

const contentScriptConfig = {
    cache,
    input: 'src/content-script/index.ts',
    output: [
        {
            file: `${OUTPUT_PATH}/adguard-content.js`,
            format: 'esm',
            sourcemap: true,
        },
    ],
    external: ['@adguard/tswebextension/content-script'],
    plugins,
};

const assistantInjectScriptConfig = {
    cache,
    input: 'src/content-script/assistant.ts',
    output: [
        {
            file: `${OUTPUT_PATH}/adguard-assistant.js`,
            format: 'esm',
            sourcemap: true,
        },
    ],
    external: ['@adguard/tswebextension/assistant-inject'],
    plugins,
};

export default [backgroundConfig, contentScriptConfig, assistantInjectScriptConfig];
