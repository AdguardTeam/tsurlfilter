import { fileURLToPath } from 'node:url';

import commonjs from '@rollup/plugin-commonjs';
import json from '@rollup/plugin-json';
import resolve from '@rollup/plugin-node-resolve';
import swc from '@rollup/plugin-swc';
import copy from 'rollup-plugin-copy';
import dts from 'rollup-plugin-dts';
import externals from 'rollup-plugin-node-externals';

/**
 * Build output path.
 */
const OUTPUT_PATH = 'dist';

/**
 * Path to the re2.wasm asset. The `re2-wasm` package loads this file by a
 * hardcoded name relative to `__dirname` at runtime, so it must be copied
 * next to the CLI bundle (`dist/re2.wasm`).
 */
const re2WasmUrl = import.meta.resolve('@adguard/re2-wasm/build/wasm/re2.wasm');
const re2WasmPath = fileURLToPath(re2WasmUrl);

/**
 * Common Rollup configuration.
 */
const commonConfig = {
    input: [
        'src/index.ts',
    ],
    cache: false,
    watch: {
        include: 'src/**',
    },
};

/**
 * Common Rollup output configuration.
 */
const commonOutputConfig = {
    format: 'esm',
    exports: 'named',
    sourcemap: false,
};

/**
 * Rollup main configuration.
 */
const mainConfig = {
    ...commonConfig,
    output: {
        ...commonOutputConfig,
        dir: OUTPUT_PATH,
        preserveModules: true,
        preserveModulesRoot: 'src',
    },
    plugins: [
        // Register NodeJS built-in modules as external
        externals(),

        // Allow node_modules resolution, so you can use 'external' to control
        // which external modules to include in the bundle
        // https://github.com/rollup/rollup-plugin-node-resolve#usage
        resolve({
            preferBuiltins: false,
            extensions: ['.js', '.ts'],
        }),

        // Allows JSON resolution
        json(),

        // JS/TS transpilation
        swc(),

        // Allows bundling cjs modules
        commonjs({ sourceMap: false }),
    ],
};

/**
 * Rollup types configuration.
 */
const typesConfig = {
    ...commonConfig,
    input: [
        'src/index.ts',
        'cli/index.ts',
    ],
    output: {
        ...commonOutputConfig,
        dir: `${OUTPUT_PATH}/types`,
        preserveModules: true,
        preserveModulesRoot: '.',
    },
    plugins: [
        // Generate d.ts files
        dts({ tsconfig: 'tsconfig.build.json' }),
    ],
};

/**
 * Rollup CLI configuration.
 *
 * Built as CommonJS (not ESM) because the bundled `@adguard/re2-wasm` loads
 * `re2.wasm` via raw `__dirname`, which is unavailable in ESM. The
 * `re2-wasm` package and the in-house ESM-only `@adguard/*` packages (which
 * use `import.meta.url`) are bundled so Rollup can transpile those constructs.
 * Matches the approach used by `@adguard/dnr-rulesets`.
 */
const cliConfig = {
    input: 'cli/index.ts',
    output: {
        ...commonOutputConfig,
        file: `${OUTPUT_PATH}/cli.cjs`,
        format: 'cjs',
        banner: '#!/usr/bin/env node',
    },
    cache: false,
    plugins: [
        externals({
            // Bundle re2-wasm (loads wasm via `__dirname`) and in-house
            // ESM-only `@adguard/*` packages (which use `import.meta.url`)
            // so the CJS output works; keep everything else external.
            exclude: [
                '@adguard/re2-wasm',
                /^@adguard\/(agtree|logger|scriptlets).*$/,
            ],
        }),
        resolve({
            preferBuiltins: false,
            extensions: ['.js', '.ts'],
        }),
        json(),
        swc(),
        commonjs({ sourceMap: false }),
        // Copy re2.wasm next to the CLI bundle; re2-wasm loads it by a
        // hardcoded name relative to `__dirname` at runtime.
        copy({ targets: [{ src: re2WasmPath, dest: OUTPUT_PATH }] }),
    ],
    watch: {
        include: 'cli/**',
    },
};

/**
 * Rollup configuration.
 */
export default [
    mainConfig,
    cliConfig,
    typesConfig,
];
