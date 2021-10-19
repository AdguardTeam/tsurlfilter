import typescript from '@rollup/plugin-typescript';
import cleanup from 'rollup-plugin-cleanup';

const DEFAULT_OUTPUT_PATH = 'dist';

const OUTPUT_PATH = process.env.PACKAGE_OUTPUT_PATH ? `${process.env.PACKAGE_OUTPUT_PATH}/dist` : DEFAULT_OUTPUT_PATH;


export default {
    input: [
        'src/index.ts',
    ],
    output: [
        {
            dir: OUTPUT_PATH,
            format: 'esm',
            sourcemap: false,
        },
    ],
    watch: {
        include: 'src/**',
    },
    plugins: [
        typescript(),
        cleanup({
            comments: ['srcmaps'],
        }),
    ],
};
