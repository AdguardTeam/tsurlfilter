/* eslint-disable jsdoc/require-file-overview */
import json from '@rollup/plugin-json';
import resolve from '@rollup/plugin-node-resolve';
import swc from '@rollup/plugin-swc';

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

/**
 * The prebuilt ExtendedCss script asset.
 *
 * The file is a single self-contained script the background injects into a
 * frame before the ExtendedCss rules, so it must stay a separate copyable
 * file. It re-exports the asset of `@adguard/tswebextension`, which the
 * consumer's bundler resolves when the file is copied into the extension.
 */
const extCssInjectScriptConfig = {
    cache,
    input: 'src/content-script/extcss.ts',
    output: [
        {
            file: `${OUTPUT_PATH}/adguard-extcss.js`,
            format: 'esm',
            sourcemap: true,
        },
    ],
    external: ['@adguard/tswebextension/extcss-inject'],
    plugins,
};

export default [backgroundConfig, contentScriptConfig, assistantInjectScriptConfig, extCssInjectScriptConfig];
