import typescript from '@rollup/plugin-typescript';
import resolve from '@rollup/plugin-node-resolve';

const contentScriptConfig = {
    input: 'src/content-script.ts',
    output: {
        dir: 'dist',
        format: 'cjs',
    },
    plugins: [typescript(), resolve()]
};

const cssHitsCounterConfig = {
    input: 'src/css-hits-counter.ts',
    output: {
        dir: 'dist',
        format: 'cjs',
    },
    plugins: [typescript(), resolve()]
};

const backgroundConfig = {
    input: 'src/background.ts',
    output: {
        dir: 'dist',
        format: 'cjs'
    },
    plugins: [typescript(), resolve()]
};

export default [
    backgroundConfig,
    contentScriptConfig,
    cssHitsCounterConfig,
];
