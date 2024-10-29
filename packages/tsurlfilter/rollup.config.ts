import resolve from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';
// FIXME why this was needed
// import nodePolyfills from 'rollup-plugin-polyfill-node';
import typescript from '@rollup/plugin-typescript';
import json from '@rollup/plugin-json';
import cleanup from 'rollup-plugin-cleanup';
import { dts } from 'rollup-plugin-dts';
import { type RollupOptions } from 'rollup';

const DIST_DIR = 'dist';

const commonPlugins = [
    json(),
    typescript({ tsconfig: 'tsconfig.build.json' }),
    commonjs({ sourceMap: false }),
    cleanup({ comments: ['srcmaps'] }),
];

const cliConfig: RollupOptions = {
    input: 'src/cli/index.ts',
    output: [
        {
            dir: `${DIST_DIR}/cli`,
            format: 'cjs',
            exports: 'named',
            sourcemap: false,
            // preserveModules: true,
            // preserveModulesRoot: 'src',
        },
        {
            dir: `${DIST_DIR}/cli`,
            entryFileNames: '[name].mjs',
            format: 'esm',
            sourcemap: false,
            // preserveModules: true,
            // preserveModulesRoot: 'src',
        },
    ],
    external: (id) => {
        return (
            /node_modules/.test(id)
            // Added because when agtree is linked using 'yarn link', its ID does not contain 'node_modules'
            || id === '@adguard/agtree'
            || id.startsWith('@adguard/agtree/')
            || id === '@adguard/scriptlets'
            || id.startsWith('@adguard/scriptlets/')
            || id === '@adguard/css-tokenizer'
            || id.startsWith('@adguard/css-tokenizer/')
        );
    },
    plugins: [
        ...commonPlugins,
        resolve({ preferBuiltins: true }),
    ],
};

const mainConfig: RollupOptions = {
    input: [
        'src/index.ts',
        // from '@adguard/tsurlfilter/declarative-converter'
        'src/rules/declarative-converter/index.ts',
        // from '@adguard/tsurlfilter/request-type'
        'src/request-type.ts',
        // FIXME update in the browser extension
        // from @adguard/tsurlfilter/simple-regex
        'src/rules/simple-regex.ts',
        // FIXME find where was used?
        // path.resolve(__dirname, 'src/rules/network-rule-options.ts'),
    ],
    output: [
        {
            dir: `${DIST_DIR}/cjs`,
            format: 'cjs',
            exports: 'named',
            sourcemap: false,
            preserveModules: true,
            preserveModulesRoot: 'src',
        },
        {
            dir: `${DIST_DIR}/esm`,
            entryFileNames: '[name].mjs',
            format: 'esm',
            sourcemap: false,
            preserveModules: true,
            preserveModulesRoot: 'src',
        },
    ],
    external: (id) => {
        return (
            /node_modules/.test(id)
            // Added because when agtree is linked using 'yarn link', its ID does not contain 'node_modules'
            || id === '@adguard/agtree'
            || id.startsWith('@adguard/agtree/')
            || id === '@adguard/scriptlets'
            || id.startsWith('@adguard/scriptlets/')
            || id === '@adguard/css-tokenizer'
            || id.startsWith('@adguard/css-tokenizer/')
        );
    },
    plugins: [
        ...commonPlugins,
        resolve({ preferBuiltins: false }),
    ],
};

const typesConfig = {
    input: {
        // from '@adguard/tsurlfilter'
        index: 'src/index.ts',
        'cli/index': 'src/cli/index.ts',
        // from '@adguard/tsurlfilter/declarative-converter'
        'declarative-converter': 'src/rules/declarative-converter/index.ts',
        // from '@adguard/tsurlfilter/request-type'
        'request-type': 'src/request-type.ts',
        // FIXME update in the browser extension
        // from @adguard/tsurlfilter/simple-regex
        'simple-regex': 'src/rules/simple-regex.ts',
        // FIXME find where was used?
        // path.resolve(__dirname, 'src/rules/network-rule-options.ts'),
    },
    output: {
        dir: `${DIST_DIR}/types`,
        format: 'es',
        preserveModules: true,
        preserveModulesRoot: 'src',
        entryFileNames: '[name].d.ts',
    },
    plugins: [
        dts(),
    ],
};

export default [
    mainConfig,
    typesConfig,
    cliConfig,
];
