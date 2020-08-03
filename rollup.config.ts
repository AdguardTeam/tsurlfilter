import resolve from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';
import sourceMaps from 'rollup-plugin-sourcemaps';
import polyfills from 'rollup-plugin-node-polyfills';
import typescript from '@rollup/plugin-typescript';
import json from '@rollup/plugin-json';
import pkg from './package.json';

const libraryName = 'TSUrlFilter';

const contentScriptFilename = 'TSUrlFilterContentScript';
const contentScriptConfig = {
    input: 'src/content-script/index.ts',
    output: [
        {
            file: `dist/${contentScriptFilename}.js`,
            name: libraryName,
            format: 'iife',
            sourcemap: true,
        },
    ],
    watch: {
        include: 'src/**',
    },
    plugins: [
        typescript(),
        commonjs(),
        resolve(),
        sourceMaps(),
    ],
};

export default [
    contentScriptConfig,
    {
        input: 'src/index.ts',
        output: [
            {
                file: pkg.main,
                format: 'cjs',
                sourcemap: true,
                globals: {
                    canvas: 'canvas',
                    bufferutil: 'bufferutil',
                    utf8Validate: 'utf8Validate',
                },
            },
            {
                file: pkg.module,
                format: 'es',
                sourcemap: true,
                globals: {
                    canvas: 'canvas',
                    bufferutil: 'bufferutil',
                    utf8Validate: 'utf-8-validate',
                },
            },
        ],
        // Indicate here external modules you don't wanna include in your bundle (i.e.: 'lodash')
        external: ['canvas', 'utf-8-validate', 'bufferutil'],
        watch: {
            include: 'src/**',
        },
        plugins: [
            // Allow json resolution
            json(),
            // Compile TypeScript files
            typescript(),
            // Allow node_modules resolution, so you can use 'external' to control
            // which external modules to include in the bundle
            // https://github.com/rollup/rollup-plugin-node-resolve#usage
            resolve({ preferBuiltins: false }),

            // Allow bundling cjs modules (unlike webpack, rollup doesn't understand cjs)
            commonjs(),
            polyfills(),

            // Resolve source maps to the original source
            sourceMaps(),
        ],
    },
];
