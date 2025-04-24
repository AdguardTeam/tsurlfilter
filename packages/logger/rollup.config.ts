import typescript from '@rollup/plugin-typescript';
import resolve from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';

const defaultConfig = {
    input: 'src/index.ts',
    output: [
        {
            dir: 'dist',
            format: 'cjs',
        },
        {
            dir: 'dist/es',
            format: 'es',
            entryFileNames: '[name].mjs',
        },
    ],
    plugins: [
        resolve(),
        commonjs(),
        typescript({
            tsconfig: 'tsconfig.build.json',
        }),
    ],
};

const logLevelCjsConfig = {
    input: 'src/LogLevel.ts',
    output: {
        dir: 'dist',
        format: 'cjs',
        entryFileNames: '[name].cjs',
    },
    plugins: [
        resolve(),
        commonjs(),
        typescript({
            tsconfig: 'tsconfig.build.json',
        }),
    ],
};

export default [
    defaultConfig,
    logLevelCjsConfig,
];
