import commonjs from '@rollup/plugin-commonjs';
import json from '@rollup/plugin-json';
import resolve from '@rollup/plugin-node-resolve';
import swc from '@rollup/plugin-swc';
import dts from 'rollup-plugin-dts';
import externals from 'rollup-plugin-node-externals';

/**
 * Build output path.
 */
const OUTPUT_PATH = 'dist';

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
 */
const cliConfig = {
    input: 'cli/index.ts',
    output: {
        ...commonOutputConfig,
        file: `${OUTPUT_PATH}/cli.js`,
        banner: '#!/usr/bin/env node',
    },
    cache: false,
    plugins: [
        externals(),
        resolve({
            preferBuiltins: false,
            extensions: ['.js', '.ts'],
        }),
        json(),
        swc(),
        commonjs({ sourceMap: false }),
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
