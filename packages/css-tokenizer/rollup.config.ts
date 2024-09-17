/**
 * @file Rollup configurations for generating CSSTokenizer builds.
 *
 * ! Please ALWAYS use the "pnpm build" command for building! Running Rollup directly will not enough, the build script
 * ! does some additional work before and after running Rollup.
 */

import typescript from '@rollup/plugin-typescript';
import resolve from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';
import dtsPlugin from 'rollup-plugin-dts';
import json from '@rollup/plugin-json';
import path from 'path';
import { readFileSync } from 'fs';

// Common constants
const ROOT_DIR = './';
const BASE_NAME = 'CSSTokenizer';
const BASE_FILE_NAME = 'csstokenizer';
const PKG_FILE_NAME = 'package.json';

const distDir = path.join(ROOT_DIR, 'dist');
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
const banner = `/*
 * ${BASE_NAME} v${pkg.version} (build date: ${new Date().toUTCString()})
 * (c) ${new Date().getFullYear()} ${pkg.author}
 * Released under the ${pkg.license} license
 * ${pkg.homepage}
 */`;

// Common plugins for all types of builds
const commonPlugins = [
    json({ preferConst: true }),
    commonjs({ sourceMap: false }),
    resolve({ preferBuiltins: false }),
    typescript({
        tsconfig: path.join(ROOT_DIR, 'tsconfig.json'),
        compilerOptions: {
            incremental: true,
            declaration: true,
            declarationDir: path.join(ROOT_DIR, 'dist/dts'),
        },
        include: ['./src/**/*.ts'],
        exclude: ['./node_modules', './test'],
        outputToFilesystem: true,
    }),
];

// CommonJS build configuration
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
    plugins: commonPlugins,
};

// Merge .d.ts files (requires `tsc` to be run first,
// because it merges .d.ts files from `dist/dts` directory)
const dts = {
    input: path.join(ROOT_DIR, 'dist/dts/src/index.d.ts'),
    output: [
        {
            file: path.join(distDir, `${BASE_FILE_NAME}.d.ts`),
            format: 'es',
            banner,
        },
    ],
    plugins: [
        dtsPlugin(),
    ],
};

// Export build configs for Rollup
export default [node, dts];
