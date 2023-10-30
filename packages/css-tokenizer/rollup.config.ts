/**
 * @file Rollup configurations for generating CSSTokenizer builds.
 *
 * ! Please ALWAYS use the "yarn build" command for building! Running Rollup directly will not enough, the build script
 * ! does some additional work before and after running Rollup.
 */

import typescript from '@rollup/plugin-typescript';
import resolve from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';
import dtsPlugin from 'rollup-plugin-dts';
import json from '@rollup/plugin-json';
import terser from '@rollup/plugin-terser';
import nodePolyfills from 'rollup-plugin-polyfill-node';
import { getBabelOutputPlugin } from '@rollup/plugin-babel';
import path from 'path';
import { readFileSync } from 'fs';

// Common constants
const ROOT_DIR = './';
const BASE_NAME = 'CSSTokenizer';
const BASE_FILE_NAME = 'csstokenizer';
const PKG_FILE_NAME = 'package.json';

const distDirLocation = path.join(ROOT_DIR, 'dist');
const pkgFileLocation = path.join(ROOT_DIR, PKG_FILE_NAME);

// Read package.json
const pkg = JSON.parse(readFileSync(pkgFileLocation, 'utf-8'));

// Check if the package.json file has all required fields (we need them for the banner)
const REQUIRED_PKG_FIELDS = [
    'author',
    'homepage',
    'license',
    'version',
];

for (const field of REQUIRED_PKG_FIELDS) {
    if (!(field in pkg)) {
        throw new Error(`Missing required field "${field}" in ${PKG_FILE_NAME}`);
    }
}

// Generate a banner with the current package & build info
const BANNER = `/*
 * ${BASE_NAME} v${pkg.version} (build date: ${new Date().toUTCString()})
 * (c) ${new Date().getFullYear()} ${pkg.author}
 * Released under the ${pkg.license} license
 * ${pkg.homepage}
 */`;

// Pre-configured TypeScript plugin
const typeScriptPlugin = typescript({
    compilerOptions: {
        // Don't emit declarations, we will do it in a separate command "yarn build-types"
        declaration: false,
    },
});

const terserPlugin = terser({
    sourceMap: true,
    output: {
        // Keep the banner in the minified output
        preamble: BANNER,
    },
    compress: {
        // It has negative impact on performance, so we disable it
        reduce_funcs: false,
    },
});

// Common plugins for all types of builds
const commonPlugins = [
    json({ preferConst: true }),
    commonjs({ sourceMap: false }),
    resolve({ preferBuiltins: false }),
    typeScriptPlugin,
];

// Plugins for Node.js builds
const nodePlugins = [
    ...commonPlugins,
    // TODO: Add other plugins if needed
    getBabelOutputPlugin({
        presets: [
            [
                '@babel/preset-env',
                {
                    targets: {
                        node: '12.0',
                    },
                },
            ],
        ],
        allowAllFormats: true,
        compact: false,
    }),
    // Minify the output with Terser
    terserPlugin,
];

// Plugins for browser builds
const browserPlugins = [
    ...commonPlugins,
    nodePolyfills(),
    // Provide better browser compatibility with Babel
    getBabelOutputPlugin({
        presets: [
            [
                '@babel/preset-env',
                {
                    targets: {
                        // https://github.com/browserslist/browserslist#best-practices
                        browsers: [
                            'last 1 version',
                            '> 1%',
                            'not dead',

                            // Specific versions
                            'chrome >= 88',
                            'firefox >= 84',
                            'edge >= 88',
                            'opera >= 80',
                            'safari >= 14',
                        ],
                    },
                },
            ],
        ],
        allowAllFormats: true,
        compact: false,
    }),
    // Minify the output with Terser
    terserPlugin,
];

// CommonJS build configuration
const cjs = {
    input: path.join(ROOT_DIR, 'src', 'index.ts'),
    output: [
        {
            file: path.join(distDirLocation, `${BASE_FILE_NAME}.js`),
            format: 'cjs',
            exports: 'auto',
            sourcemap: false,
            banner: BANNER,
        },
    ],
    plugins: nodePlugins,
};

// Browser-friendly IIFE build configuration
const iife = {
    input: path.join(ROOT_DIR, 'src', 'index.ts'),
    output: [
        {
            file: path.join(distDirLocation, `${BASE_FILE_NAME}.iife.min.js`),
            format: 'iife',
            exports: 'auto',
            sourcemap: false,
            banner: BANNER,
            name: BASE_NAME,
        },
    ],
    plugins: browserPlugins,
};

// Merge .d.ts files (requires `tsc` to be run first, because it merges .d.ts files from `dist/types` directory)
const dts = {
    input: path.join(ROOT_DIR, 'dist', 'types', 'src', 'index.d.ts'),
    output: [
        {
            file: path.join(distDirLocation, `${BASE_FILE_NAME}.d.ts`),
            format: 'es',
            banner: BANNER,
        },
    ],
    plugins: [
        dtsPlugin(),
    ],
};

// Export build configs for Rollup
export default [cjs, iife, dts];
