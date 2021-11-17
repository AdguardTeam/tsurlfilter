import typescript from '@rollup/plugin-typescript';
import cleanup from 'rollup-plugin-cleanup';

const DEFAULT_OUTPUT_PATH = 'dist';

const OUTPUT_PATH = process.env.PACKAGE_OUTPUT_PATH ? `${process.env.PACKAGE_OUTPUT_PATH}/dist` : DEFAULT_OUTPUT_PATH;


const commonConfig = {
    plugins: [
        typescript(),
        cleanup({
            comments: ['srcmaps'],
        }),
    ],
}

const contentScriptConfig = {
    input: 'src/content-script/index.ts',
    output: [
        {
            file: `${OUTPUT_PATH}/content-script.js`,
            format: 'esm',
            sourcemap: false,
        },
    ],
    watch: {
        include: 'src/content-script/**',
    },
    ...commonConfig,
};


const backgroundConfig = {
    input: [
        'src/background/index.ts',
    ],
    output: [
        {
            dir: OUTPUT_PATH,
            format: 'esm',
            sourcemap: false,
        },
    ],
    watch: {
        include: 'src/background/**',
    },
    ...commonConfig,
};

export default [
    backgroundConfig,
    contentScriptConfig,
];
