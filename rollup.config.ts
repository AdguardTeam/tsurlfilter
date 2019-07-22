// tslint:disable-next-line: import-name
import resolve from 'rollup-plugin-node-resolve';
// tslint:disable-next-line: import-name
import commonjs from 'rollup-plugin-commonjs';
// tslint:disable-next-line: import-name
import sourceMaps from 'rollup-plugin-sourcemaps';
// tslint:disable-next-line: import-name
import camelCase from 'lodash.camelcase';
// tslint:disable-next-line: import-name
import typescript from 'rollup-plugin-typescript2';
// tslint:disable-next-line: import-name
import json from 'rollup-plugin-json';

const pkg = require('./package.json');

const libraryName = 'tsurlfilter';

export default {
    input: 'src/index.ts',
    output: [
        { file: pkg.main, name: camelCase(libraryName), format: 'umd', sourcemap: true },
        { file: pkg.module, format: 'es', sourcemap: true },
    ],
    // Indicate here external modules you don't wanna include in your bundle (i.e.: 'lodash')
    external: [],
    watch: {
        include: 'src/**',
    },
    plugins: [
        // Allow json resolution
        json(),
        // Compile TypeScript files
        typescript({ useTsconfigDeclarationDir: true }),
        // Allow bundling cjs modules (unlike webpack, rollup doesn't understand cjs)
        commonjs(),
        // Allow node_modules resolution, so you can use 'external' to control
        // which external modules to include in the bundle
        // https://github.com/rollup/rollup-plugin-node-resolve#usage
        resolve(),

        // Resolve source maps to the original source
        sourceMaps(),
    ],
};
