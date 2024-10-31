import { fileURLToPath } from 'node:url';

import resolve from '@rollup/plugin-node-resolve';
import typescript from '@rollup/plugin-typescript';
import json from '@rollup/plugin-json';
import cleanup from 'rollup-plugin-cleanup';
import commonjs from '@rollup/plugin-commonjs';
import { preserveShebangs } from 'rollup-plugin-preserve-shebangs';

const DEFAULT_OUTPUT_PATH = 'dist';
const OUTPUT_PATH = process.env.PACKAGE_OUTPUT_PATH ? `${process.env.PACKAGE_OUTPUT_PATH}/dist` : DEFAULT_OUTPUT_PATH;

const COMPANIESDB_TRACKERS_FILE = 'src/lib/common/companies-db-service/trackers-min.js';

const cache = false;

const commonPlugins = [
    // Allow json resolution
    json(),

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
];

const contentScriptConfig = {
    cache,
    input: 'src/lib/mv2/content-script/index.ts',
    output: [
        {
            file: `${OUTPUT_PATH}/content-script.js`,
            format: 'esm',
            sourcemap: false,
        },
    ],
    external: [
        'zod',
        'webextension-polyfill',
        '@adguard/extended-css',
        '@adguard/tsurlfilter',
        '@adguard/agtree',
        '@adguard/assistant',
        'tldts',
    ],
    watch: {
        include: 'src/lib/mv2/content-script/**',
    },
    plugins: commonPlugins,
};

// Separate config for CssHitsCounter to better tree shake and do not export
// browser-polyfill in the target application.
const cssHitsCounterConfig = {
    cache,
    input: 'src/lib/common/content-script/css-hits-counter.ts',
    output: [
        {
            file: `${OUTPUT_PATH}/css-hits-counter.js`,
            format: 'esm',
            sourcemap: false,
        },
    ],
    external: [
        '@adguard/extended-css',
    ],
    watch: {
        include: 'src/lib/common/content-script/css-hits-counter.ts',
    },
    plugins: commonPlugins,
};

const contentScriptMv3Config = {
    cache,
    input: 'src/lib/mv3/content-script/index.ts',
    output: [
        {
            file: `${OUTPUT_PATH}/content-script.mv3.js`,
            format: 'esm',
            sourcemap: false,
        },
    ],
    external: [
        'zod',
        'webextension-polyfill',
        '@adguard/extended-css',
        '@adguard/tsurlfilter',
        '@adguard/agtree',
        '@adguard/assistant',
    ],
    watch: {
        include: 'src/lib/mv3/content-script/**',
    },
    plugins: commonPlugins,
};

const backgroundMv2Config = {
    cache,
    input: ['src/lib/mv2/background/index.ts'],
    output: [
        {
            dir: OUTPUT_PATH,
            format: 'esm',
            sourcemap: false,
            chunkFileNames: '[name].js',
            manualChunks: {
                'text-encoding-polyfill': [
                    'node_modules/text-encoding',
                ],
            },
        },
    ],
    watch: {
        include: 'src/lib/mv2/background/**',
    },
    external: [
        'zod',
        'webextension-polyfill',
        '@adguard/tsurlfilter',
        '@adguard/agtree',
        '@adguard/scriptlets',
        'tldts',
        'bowser',
        'deepmerge',
        'nanoid',
        'lru_map',
        'lodash-es',
        /**
         * Define empty 'trackers-min' file as external
         * separate module (which should be build separately @see {@link companiesDbTrackersMin})
         * so it will be replaced with real data after the build.
         */
        fileURLToPath(
            new URL(
                COMPANIESDB_TRACKERS_FILE,
                import.meta.url,
            ),
        ),
    ],
    plugins: [
        ...commonPlugins,
        commonjs(),
    ],
};

const backgroundMv3Config = {
    cache,
    input: ['src/lib/mv3/background/index.ts'],
    output: [
        {
            file: `${OUTPUT_PATH}/index.mv3.js`,
            format: 'esm',
            sourcemap: false,
        },
    ],
    watch: {
        include: 'src/lib/mv3/background/**',
    },
    external: [
        'zod',
        '@adguard/tsurlfilter',
        '@adguard/agtree',
        'deepmerge',
        'tldts',
        'webextension-polyfill',
        /**
         * Define empty 'trackers-min' file as external
         * separate module (which should be build separately @see {@link companiesDbTrackersMin})
         * so it will be replaced with real data after the build.
         */
        fileURLToPath(
            new URL(
                COMPANIESDB_TRACKERS_FILE,
                import.meta.url,
            ),
        ),
    ],
    plugins: [
        ...commonPlugins,
        commonjs(),
    ],
};

/**
 * Separate config for companies-db trackers-min data.
 */
const companiesDbTrackersMin = {
    input: COMPANIESDB_TRACKERS_FILE,
    output: [
        {
            file: `${OUTPUT_PATH}/trackers-min.js`,
            sourcemap: false,
        },
    ],
};

const cliConfig = {
    cache,
    input: 'src/cli/index.ts',
    output: [
        {
            file: `${OUTPUT_PATH}/cli.js`,
            format: 'cjs',
            sourcemap: false,
        },
    ],
    watch: {
        include: 'src/cli/**',
    },
    external: [
        'path',
        'fs',
        'https',
        'fs-extra',
        'commander',
    ],
    plugins: [
        ...commonPlugins,
        commonjs(),
        preserveShebangs(),
    ],
};

const mv3UtilsConfig = {
    cache,
    input: 'src/lib/mv3/utils/get-filter-name.ts',
    output: [
        {
            file: `${OUTPUT_PATH}/mv3-utils.js`,
            // TODO: Replace via 'esm'
            format: 'cjs',
            sourcemap: false,
        },
    ],
    watch: {
        include: 'src/lib/mv3/utils/get-filter-name.ts',
    },
    external: ['path', 'fs-extra', 'commander'],
    plugins: [...commonPlugins],
};

const assistantInjectScriptConfig = {
    cache,
    input: 'src/lib/mv2/content-script/assistant-inject.ts',
    output: [
        {
            file: `${OUTPUT_PATH}/assistant-inject.js`,
            format: 'esm',
            sourcemap: false,
        },
    ],
    watch: {
        include: 'src/lib/mv2/content-script/assistant-inject.ts',
    },
    plugins: [
        ...commonPlugins,
        commonjs(),
    ],
};

const gpcContentScriptSrc = 'src/lib/mv3/content-script/gpc.ts';
const gpcContentScriptOutput = `${OUTPUT_PATH}/gpc.js`;

const gpcContentScriptConfig = {
    cache,
    input: gpcContentScriptSrc,
    output: [
        {
            file: gpcContentScriptOutput,
            format: 'esm',
            sourcemap: false,
        },
    ],
    watch: {
        include: gpcContentScriptSrc,
    },
    plugins: commonPlugins,
};

const hideDocumentReferrerContentScriptSrc = 'src/lib/mv3/content-script/hide-document-referrer.ts';
const hideDocumentReferrerContentScriptOutput = `${OUTPUT_PATH}/hideDocumentReferrer.js`;

const hideDocumentReferrerContentScriptConfig = {
    cache,
    input: hideDocumentReferrerContentScriptSrc,
    output: [
        {
            file: hideDocumentReferrerContentScriptOutput,
            format: 'esm',
            sourcemap: false,
        },
    ],
    watch: {
        include: hideDocumentReferrerContentScriptSrc,
    },
    plugins: commonPlugins,
};

// TODO: Remove index files from 'src/lib', 'src/lib/mv2', 'src/lib/mv3' because
// they are not participating in the build process and not specified as entry points.
export default [
    backgroundMv2Config,
    backgroundMv3Config,
    companiesDbTrackersMin,
    contentScriptConfig,
    cssHitsCounterConfig,
    contentScriptMv3Config,
    cliConfig,
    mv3UtilsConfig,
    assistantInjectScriptConfig,
    gpcContentScriptConfig,
    hideDocumentReferrerContentScriptConfig,
];
