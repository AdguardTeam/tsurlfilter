/**
 * @file Rollup configurations for generating AGTree builds.
 */
import typescript from '@rollup/plugin-typescript';
import resolve from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';
import externals from 'rollup-plugin-node-externals';
import json from '@rollup/plugin-json';
import path from 'node:path';
import { readFileSync } from 'node:fs';

import { compatibilityTablePlugin } from './rollup.plugins';

// eslint-disable-next-line @typescript-eslint/naming-convention, no-underscore-dangle
const __dirname = path.dirname(new URL(import.meta.url).pathname);

const ROOT_DIR = __dirname;
const BASE_NAME = 'AGTree';
const PKG_FILE_NAME = 'package.json';

const distDir = path.resolve(ROOT_DIR, 'dist');
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
    externals(),
    json({ preferConst: true }),
    resolve({ preferBuiltins: false }),
    commonjs({ sourceMap: false }),
    typescript({
        tsconfig: path.resolve(ROOT_DIR, 'tsconfig.build.json'),
    }),
];

const main = {
    cache: false,
    input: [
        'src/index.ts',
        'src/parser/index.ts',
        'src/generator/index.ts',
        'src/converter/index.ts',
        'src/utils/index.ts',
    ],
    output: [
        {
            dir: distDir,
            format: 'esm',
            sourcemap: false,
            preserveModules: true,
            preserveModulesRoot: 'src',
            banner,
        },
    ],
    plugins: [
        ...commonPlugins,
        compatibilityTablePlugin(),
    ],
};

// Export build configs for Rollup
export default [
    main,
];
