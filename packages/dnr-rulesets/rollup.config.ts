import json from '@rollup/plugin-json';
import resolve from '@rollup/plugin-node-resolve';
import swc from '@rollup/plugin-swc';
import { omit } from 'lodash-es';
import { dts } from 'rollup-plugin-dts';
import nodeExternals from 'rollup-plugin-node-externals';

const DIST_DIR = 'dist';

const entryPoints = {
    'cli': 'src/cli.ts',
    'lib/index': 'src/lib/index.ts',
    'utils/index': 'src/utils/index.ts',
};

const mainConfig = {
    input: entryPoints,
    output: [
        {
            dir: DIST_DIR,
            format: 'esm',
            exports: 'named',
            preserveModules: true,
            preserveModulesRoot: 'src',
        },
    ],
    plugins: [
        resolve({ extensions: ['.ts', '.js'] }),
        json(),
        swc(),
        nodeExternals(),
    ],
};

const typesConfig = {
    input: omit(entryPoints, 'cli'),
    output: {
        dir: `${DIST_DIR}/types`,
        format: 'esm',
        exports: 'named',
        preserveModules: true,
        preserveModulesRoot: 'src',
    },
    plugins: [
        dts({ tsconfig: 'tsconfig.build.json' }),
    ],
};

export default [
    mainConfig,
    typesConfig,
];
