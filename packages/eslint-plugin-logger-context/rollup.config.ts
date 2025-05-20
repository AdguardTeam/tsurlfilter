import typescript from '@rollup/plugin-typescript';
import resolve from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';
import json from '@rollup/plugin-json';

export default {
    input: 'src/index.ts',
    output: [{
        dir: 'dist',
        format: 'cjs',
    },
    {
        dir: 'dist/es',
        format: 'es',
        entryFileNames: '[name].mjs',
    }],
    plugins: [
        // To resolve export version and name from package.json
        json(),
        resolve(),
        commonjs(),
        typescript({
            tsconfig: 'tsconfig.build.json',
        }),
    ],
};
