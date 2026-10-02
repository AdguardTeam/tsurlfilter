import typescript from '@rollup/plugin-typescript';
import resolve from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';

const cssHitsCounterConfig = {
    input: 'src/css-hits-counter.ts',
    output: {
        dir: 'dist',
        format: 'cjs',
    },
    plugins: [
        typescript(),
        resolve(),
    ],
};

export default [
    cssHitsCounterConfig,
    {
        input: 'src/canvas-protection.ts',
        output: { file: 'dist/canvas-protection.cjs', format: 'cjs' },
        treeshake: { moduleSideEffects: false },
        external: ['node:assert/strict', 'node:vm'],
        plugins: [typescript(), resolve({ browser: true }), commonjs()],
    },
];
