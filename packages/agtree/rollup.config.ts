/**
 * @file Rollup configurations for generating AGTree builds.
 *
 * ! Please ALWAYS use the "pnpm build" command for building!
 */
import typescript from '@rollup/plugin-typescript';
import resolve from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';
import externals from 'rollup-plugin-node-externals';
import dtsPlugin from 'rollup-plugin-dts';
import nodePolyfills from 'rollup-plugin-polyfill-node';
import alias from '@rollup/plugin-alias';
import { getBabelOutputPlugin } from '@rollup/plugin-babel';
import json from '@rollup/plugin-json';
import terser from '@rollup/plugin-terser';
import path from 'node:path';
import { readFileSync } from 'node:fs';
import { type Plugin } from 'rollup';

// eslint-disable-next-line @typescript-eslint/naming-convention, no-underscore-dangle
const __dirname = path.dirname(new URL(import.meta.url).pathname);

const ROOT_DIR = __dirname;
const BASE_FILE_NAME = 'agtree';
const BASE_NAME = 'AGTree';
const PKG_FILE_NAME = 'package.json';

const distDir = path.join(ROOT_DIR, 'dist');
const pkgFileLocation = path.join(ROOT_DIR, PKG_FILE_NAME);

// Read package.json
const pkg = JSON.parse(readFileSync(pkgFileLocation, 'utf-8'));

// Check if the package.json file has all required fields
// (we need them for the banner)
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
const banner = `/*
 * ${BASE_NAME} v${pkg.version} (build date: ${new Date().toUTCString()})
 * (c) ${new Date().getFullYear()} ${pkg.author}
 * Released under the ${pkg.license} license
 * ${pkg.homepage}
 */`;

// Pre-configured TypeScript plugin
const typeScriptPlugin = typescript({
    tsconfig: path.join(ROOT_DIR, 'tsconfig.json'),
    compilerOptions: {
        // Don't emit declarations, we will do it in a separate command
        declaration: false,
    },
});

// Common plugins for all types of builds
const commonPlugins = [
    alias({
        entries: [
            // replace dynamic compatibility table data builder with the pre-built data file
            {
                find: './compatibility-table-data',
                replacement: path.resolve(ROOT_DIR, 'dist', 'compatibility-tables.json'),
            },
        ],
    }),
    json({ preferConst: true }),
    commonjs({ sourceMap: false }),
    resolve({ preferBuiltins: false }),
    typeScriptPlugin,
];

/**
 * Plugins for Node.js builds.
 *
 * @param esm Whether to build an ESM module.
 *
 * @returns List of Rollup plugins.
 */
export const getNodePlugins = (esm = false): Plugin[] => [
    ...commonPlugins,
    alias({
        // Add ".js" extension to all imports of the "semver" package, eg "semver/functions/..."
        // We need this because we import functions from the "semver" package directly,
        // otherwise it will cause a "circular dependency" warning during the build.
        // See https://github.com/npm/node-semver/issues/381
        // Rollup detects "semver" as an external dependency, so it doesn't add the ".js"
        // extension by default, and we need to do it manually here, otherwise the ESM
        // build will fail with "Cannot find module" error.
        entries: [
            { find: /^semver\/(.*)(?<!\.js)$/, replacement: 'semver/$1.js' },
        ],
    }),
    externals(),
    // Provide better browser compatibility with Babel
    getBabelOutputPlugin({
        presets: [
            [
                '@babel/preset-env',
                {
                    modules: esm ? false : 'auto',
                    // at least Node.js 17
                    targets: {
                        node: '17',
                    },
                },
            ],
        ],
        allowAllFormats: true,
        compact: false,
    }),
];

// Plugins for browser builds
export const browserPlugins = [
    ...commonPlugins,
    nodePolyfills(),
    // The build of CSSTree is a bit complicated (patches, require "emulation", etc.),
    // so here we only specify the pre-built version by an alias
    alias({
        entries: [
            {
                find: '@adguard/ecss-tree',
                replacement: path.resolve(
                    'node_modules/@adguard/ecss-tree/dist/ecsstree.umd.min.js',
                ),
            },
        ],
    }),
    // Provide better browser compatibility with Babel
    getBabelOutputPlugin({
        presets: [
            [
                '@babel/preset-env',
                {
                    targets: {
                        browsers: [
                            'chrome >= 80',
                            'firefox >= 78',
                            'edge >= 80',
                            'opera >= 67',
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
    terser({
        output: {
            // Keep the banner in the minified output
            preamble: banner,
        },
        compress: {
            passes: 3,
        },
    }),
];

// CommonJS build configuration
const cjs = {
    input: path.join(ROOT_DIR, 'src', 'index.ts'),
    output: [
        {
            file: path.join(distDir, `${BASE_FILE_NAME}.js`),
            format: 'cjs',
            exports: 'auto',
            sourcemap: false,
            banner,
        },
    ],
    plugins: getNodePlugins(),
};

// ECMAScript build configuration
const esm = {
    input: path.join(ROOT_DIR, 'src', 'index.ts'),
    output: [
        {
            file: path.join(distDir, `${BASE_FILE_NAME}.mjs`),
            format: 'esm',
            sourcemap: false,
            banner,
        },
    ],
    plugins: getNodePlugins(),
};

// Merge .d.ts files (requires `tsc` to be run first,
// because it merges .d.ts files from `dist/types` directory)
const dts = {
    input: path.join(ROOT_DIR, 'dist', 'types', 'src', 'index.d.ts'),
    output: [
        {
            file: path.join(distDir, `${BASE_FILE_NAME}.d.ts`),
            format: 'es',
            banner,
        },
    ],
    plugins: [
        externals(),
        dtsPlugin(),
    ],
};

// Export build configs for Rollup
export default [cjs, esm, dts];
