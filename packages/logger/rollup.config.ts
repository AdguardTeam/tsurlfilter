import commonjs from '@rollup/plugin-commonjs';
import resolve from '@rollup/plugin-node-resolve';
import typescript from '@rollup/plugin-typescript';

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
        resolve(),
        commonjs(),
        typescript({
            tsconfig: 'tsconfig.build.json',
        }),
    ],
};
