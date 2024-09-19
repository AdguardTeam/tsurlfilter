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
import alias from '@rollup/plugin-alias';
import json from '@rollup/plugin-json';
import replace from '@rollup/plugin-replace';
import path from 'node:path';
import { readFileSync } from 'node:fs';

// eslint-disable-next-line @typescript-eslint/naming-convention, no-underscore-dangle
const __dirname = path.dirname(new URL(import.meta.url).pathname);

const ROOT_DIR = __dirname;
const BASE_FILE_NAME = 'agtree';
const BASE_NAME = 'AGTree';
const PKG_FILE_NAME = 'package.json';
const COMPATIBILITY_TABLE_FILENAME = 'compatibility-table-data.js';

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

// Common plugins for all types of builds
export const commonPlugins = [
    alias({
        entries: [
            // Replace dynamic compatibility table data builder with the pre-built data file
            {
                find: './compatibility-table-data',
                replacement: path.resolve(distDir, COMPATIBILITY_TABLE_FILENAME),
            },
            // Add ".js" extension to all imports of the "semver" package, eg "semver/functions/..."
            // We need this because we import functions from the "semver" package directly,
            // otherwise it will cause a "circular dependency" warning during the build.
            // See https://github.com/npm/node-semver/issues/381
            // Rollup detects "semver" as an external dependency, so it doesn't add the ".js"
            // extension by default, and we need to do it manually here, otherwise the ESM
            // build will fail with "Cannot find module" error.
            {
                find: /semver\/(.*)(?<!\.js)$/,
                replacement: 'semver/$1.js',
            },
        ],
    }),
    externals(),
    json({ preferConst: true }),
    resolve({ preferBuiltins: false }),
    commonjs({ sourceMap: false }),
    typescript({
        tsconfig: path.join(ROOT_DIR, 'tsconfig.json'),
        compilerOptions: {
            incremental: true,
            declaration: true,
            declarationDir: path.join(ROOT_DIR, 'dist/types'),
        },
        include: [path.join(ROOT_DIR, './src/**/*.ts')],
        exclude: [path.join(ROOT_DIR, './node_modules'), path.join(ROOT_DIR, './test')],
        outputToFilesystem: false,
    }),
    replace({
        preventAssignment: true,
        delimiters: ["'", "'"],
        values: {
            [path.join(distDir, COMPATIBILITY_TABLE_FILENAME)]: `'./${COMPATIBILITY_TABLE_FILENAME}'`,
        },
    }),
];

const compatibilityTablesBanner = `/**
* @file Compatibility tables data for AGTree
*
* This file is auto-generated from YAML files in the "compatibility-tables" directory.
* It is optimized for better runtime usage and storage efficiency.
*
* We use "shared" section to share the same values between different map keys
* to reduce the storage usage.
*/`;

const compatibilityTables = {
    input: path.join(distDir, 'compatibility-table-data.json'),
    output: [
        {
            file: path.join(distDir, COMPATIBILITY_TABLE_FILENAME),
            format: 'cjs',
            exports: 'named',
            sourcemap: false,
            banner: compatibilityTablesBanner,
        },
    ],
    plugins: [json()],
};

const node = {
    input: path.join(ROOT_DIR, 'src/index.ts'),
    output: [
        {
            file: path.join(distDir, `${BASE_FILE_NAME}.js`),
            format: 'cjs',
            exports: 'auto',
            sourcemap: false,
            banner,
        },
        {
            file: path.join(distDir, `${BASE_FILE_NAME}.mjs`),
            format: 'esm',
            sourcemap: false,
            banner,
        },
    ],
    external: [
        path.resolve(distDir, COMPATIBILITY_TABLE_FILENAME),
    ],
    plugins: commonPlugins,
};

// Merge .d.ts files (requires `tsc` to be run first,
// because it merges .d.ts files from `dist/types` directory)
const dts = {
    input: path.join(ROOT_DIR, 'dist/types/src/index.d.ts'),
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
export default [compatibilityTables, node, dts];
