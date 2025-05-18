import typescript from '@rollup/plugin-typescript';
import resolve from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';

const commonPlugins = [
    resolve(),
    commonjs(),
    typescript({
        tsconfig: 'tsconfig.build.json',
    }),
];

const defaultConfig = {
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
    plugins: commonPlugins,
};

const esLintRuleConfig = {
    input: 'eslint-rules/index.ts',
    output: [{
        dir: 'dist/eslint-rule',
        format: 'cjs',
        entryFileNames: '[name].cjs',
    },
    {
        dir: 'dist/eslint-rule/es',
        format: 'es',
        entryFileNames: '[name].mjs',
    }],
    plugins: commonPlugins,
};

export default [
    defaultConfig,
    esLintRuleConfig,
];
