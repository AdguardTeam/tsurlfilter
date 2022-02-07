import typescript from '@rollup/plugin-typescript';
import cleanup from 'rollup-plugin-cleanup';
import commonjs from '@rollup/plugin-commonjs';
import { preserveShebangs } from 'rollup-plugin-preserve-shebangs';

const DEFAULT_OUTPUT_PATH = 'dist';
const OUTPUT_PATH = process.env.PACKAGE_OUTPUT_PATH ? `${process.env.PACKAGE_OUTPUT_PATH}/dist` : DEFAULT_OUTPUT_PATH;

const commonConfig = {
    plugins: [
        typescript(),
        commonjs(),
        cleanup({
            comments: ['srcmaps'],
        }),
    ],
};

const contentScriptConfig = {
    input: 'src/content-script/index.ts',
    output: [
        {
            file: `${OUTPUT_PATH}/content-script.js`,
            format: 'esm',
            sourcemap: false,
        },
    ],
    external: ['zod', 'webextension-polyfill', 'extended-css', '@adguard/tsurlfilter', '@adguard/assistant'],
    watch: {
        include: 'src/content-script/**',
    },
    ...commonConfig,
};

const backgroundConfig = {
    input: ['src/background/index.ts'],
    output: [
        {
            dir: OUTPUT_PATH,
            format: 'esm',
            sourcemap: false,
        },
    ],
    watch: {
        include: 'src/background/**',
    },
    external: ['zod', 'webextension-polyfill', '@adguard/tsurlfilter', '@adguard/scriptlets', 'tldts', 'bowser'],
    ...commonConfig,
};

const cliConfig = {
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
        'fs-extra',
        'commander',
    ],
    plugins: [...commonConfig.plugins, preserveShebangs()],
};

export default [backgroundConfig, contentScriptConfig, cliConfig];
