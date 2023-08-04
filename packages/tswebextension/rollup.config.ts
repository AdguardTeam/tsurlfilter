import resolve from '@rollup/plugin-node-resolve';
import typescript from '@rollup/plugin-typescript';
import cleanup from 'rollup-plugin-cleanup';
import commonjs from '@rollup/plugin-commonjs';
import { preserveShebangs } from 'rollup-plugin-preserve-shebangs';

const DEFAULT_OUTPUT_PATH = 'dist';
const OUTPUT_PATH = process.env.PACKAGE_OUTPUT_PATH ? `${process.env.PACKAGE_OUTPUT_PATH}/dist` : DEFAULT_OUTPUT_PATH;

const cache = false;

const commonPlugins = [
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
    input: 'src/lib/mv2/content-script/css-hits-counter.ts',
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
        include: 'src/lib/mv2/content-script/css-hits-counter.ts',
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
            file: `${OUTPUT_PATH}/index.js`,
            format: 'esm',
            sourcemap: false,
        },
    ],
    watch: {
        include: 'src/lib/mv2/background/**',
    },
    external: [
        'zod',
        'webextension-polyfill',
        '@adguard/tsurlfilter',
        '@adguard/scriptlets',
        'tldts',
        'bowser',
        'deepmerge',
        'nanoid',
        'lru_map',
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
        'deepmerge',
        'tldts',
        'webextension-polyfill',
        'util',
        'assert',
        'stream',
    ],
    plugins: [
        ...commonPlugins,
        commonjs(),
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
    external: ['path', 'fs-extra', 'commander'],
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

export default [
    backgroundMv2Config,
    backgroundMv3Config,
    contentScriptConfig,
    cssHitsCounterConfig,
    contentScriptMv3Config,
    cliConfig,
    mv3UtilsConfig,
    assistantInjectScriptConfig,
];
