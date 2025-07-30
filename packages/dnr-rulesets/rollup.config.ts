import { fileURLToPath } from 'node:url';

import commonjs from '@rollup/plugin-commonjs';
import json from '@rollup/plugin-json';
import resolve from '@rollup/plugin-node-resolve';
import swc from '@rollup/plugin-swc';
import copy from 'rollup-plugin-copy';
import { dts } from 'rollup-plugin-dts';
import { nodeExternals } from 'rollup-plugin-node-externals';

const DIST_DIR = 'dist';

const re2WasmUrl = await import.meta.resolve('@adguard/re2-wasm/build/wasm/re2.wasm');
const re2WasmPath = fileURLToPath(re2WasmUrl);

const entryPoints = {
    'lib/index': 'src/lib/index.ts',
    'utils/index': 'src/utils/index.ts',
};

const mainConfig = {
    input: entryPoints,
    output: [{
        dir: DIST_DIR,
        format: 'esm',
        exports: 'named',
    }],
    plugins: [
        nodeExternals(),
        resolve({ extensions: ['.ts', '.js'] }),
        json(),
        swc(),
        // Required to handle sprintf-js package from agtree
        commonjs(),
    ],
};

const cliConfig = {
    input: 'src/cli.ts',
    output: [{
        file: `${DIST_DIR}/cli.cjs`,
        // Not ESM, because re2-wasm package in ESM format uses raw `__dirname`
        // without `import.meta.url` wrapper.
        format: 'cjs',
        exports: 'named',
        banner: '#!/usr/bin/env node',
    }],
    plugins: [
        resolve({ extensions: ['.ts', '.js'] }),
        json(),
        swc(),
        nodeExternals({
            exclude: [
                // Bundle re2-wasm and its dependencies to include WASM files
                '@adguard/re2-wasm',
                // Bundle all AdGuard packages to avoid issues with
                // `import.meta.url` in ESM format (all our libraries in
                // ESM only), since output is CJS (because of re2-wasm).
                /^@adguard\/(agtree|logger|tsurlfilter).*$/,
            ],
        }),
        commonjs(),
        // We need to copy the re2.wasm file to the dist directory, because re2
        // package will try to load this file with hardcoded name in the runtime.
        copy({ targets: [{ src: re2WasmPath, dest: DIST_DIR }] }),
    ],
};

const typesConfig = {
    input: entryPoints,
    output: {
        dir: `${DIST_DIR}/types`,
        format: 'esm',
        exports: 'named',
        preserveModules: true,
        preserveModulesRoot: 'src',
    },
    plugins: [
        dts({ tsconfig: 'tsconfig.build.json' }),
    ],
};

export default [
    mainConfig,
    cliConfig,
    typesConfig,
];
