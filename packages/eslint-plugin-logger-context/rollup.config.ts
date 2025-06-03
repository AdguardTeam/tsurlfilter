import typescript from '@rollup/plugin-typescript';
import resolve from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';
import json from '@rollup/plugin-json';

// TODO: commonjs format is needed since we use eslint in common js format and
// it require to load plugins in cjs format, when we will migrate to eslint9 or
// another linter we can remove this format.
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
