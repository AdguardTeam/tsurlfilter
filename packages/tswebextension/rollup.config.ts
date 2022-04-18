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
    commonjs(),
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
    external: ['zod', 'webextension-polyfill', 'extended-css', '@adguard/tsurlfilter', '@adguard/assistant'],
    watch: {
        include: 'src/lib/mv2/content-script/**',
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
    external: ['zod', 'extended-css', '@adguard/tsurlfilter', '@adguard/assistant'],
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
    external: ['zod', 'webextension-polyfill', '@adguard/tsurlfilter', '@adguard/scriptlets', 'tldts', 'bowser'],
    plugins: commonPlugins,
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
    external: ['zod', '@adguard/tsurlfilter', 'deepmerge'],
    plugins: commonPlugins,
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
    plugins: [...commonPlugins, preserveShebangs()],
};

export default [
    backgroundMv2Config,
    backgroundMv3Config,
    contentScriptConfig,
    contentScriptMv3Config,
    cliConfig,
];
