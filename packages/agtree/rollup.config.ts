/**
 * @file Rollup configurations for generating AGTree builds.
 */
import typescript from '@rollup/plugin-typescript';
import resolve from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';
// FIXME check agtree is working without this
// import externals from 'rollup-plugin-node-externals';
import alias from '@rollup/plugin-alias';
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
    alias({
        entries: [
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
    json({ preferConst: true }),
    resolve({ preferBuiltins: false }),
    commonjs({ sourceMap: false }),
    typescript(),
];

const main = {
    input: [
        path.resolve(ROOT_DIR, 'src/index.ts'),
        path.resolve(ROOT_DIR, 'src/parser/index.ts'),
        path.resolve(ROOT_DIR, 'src/generator/index.ts'),
        path.resolve(ROOT_DIR, 'src/serializer/index.ts'),
        path.resolve(ROOT_DIR, 'src/deserializer/index.ts'),
    ],
    output: [
        {
            dir: `${distDir}/cjs`,
            format: 'cjs',
            exports: 'named',
            sourcemap: false,
            preserveModules: true,
            preserveModulesRoot: 'src',
            banner,
        },
        {
            dir: `${distDir}/esm`,
            entryFileNames: '[name].mjs',
            format: 'esm',
            sourcemap: false,
            preserveModules: true,
            preserveModulesRoot: 'src',
            banner,
        },
    ],
    external: [
        /node_modules/,
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
