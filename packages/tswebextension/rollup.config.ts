import path from 'path';
import typescript from '@rollup/plugin-typescript';
import cleanup from 'rollup-plugin-cleanup';
import copy from 'rollup-plugin-copy';
import commonjs from '@rollup/plugin-commonjs';

import { createRequire } from 'module';
const scriptletsPath = createRequire(import.meta.url).resolve('@adguard/scriptlets');
const scriptletsDistPath = path.resolve(scriptletsPath, '../..');

const DEFAULT_OUTPUT_PATH = 'dist';
const OUTPUT_PATH = process.env.PACKAGE_OUTPUT_PATH ? `${process.env.PACKAGE_OUTPUT_PATH}/dist` : DEFAULT_OUTPUT_PATH;


const commonConfig = {
    plugins: [
        typescript(),
        commonjs(),
        cleanup({
            comments: ['srcmaps'],
        }),
        copy({
            targets: [
                { src: `${scriptletsDistPath}/redirects.yml`, dest: `${OUTPUT_PATH}/war/` },
                { src: `${scriptletsDistPath}/redirect-files/*`, dest: `${OUTPUT_PATH}/war/redirects` },
            ],
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
    external: [
        'zod',
        'webextension-polyfill',
        'extended-css',
        '@adguard/tsurlfilter',
        '@adguard/assistant',
    ],
    watch: {
        include: 'src/content-script/**',
    },
    ...commonConfig,
};


const backgroundConfig = {
    input: [
        'src/background/index.ts',
    ],
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
    external: [
        'zod',
        'webextension-polyfill',
        '@adguard/tsurlfilter',
        '@adguard/scriptlets',
        'tldts',
        'bowser',
    ],
    ...commonConfig,
};

export default [
    backgroundConfig,
    contentScriptConfig,
];
