/**
 * @file This is a small helper to build an IIFE bundle for the browser environment.
 *
 * @note It uses the main Rollup configuration from the root of the project.
 */
import { rollup } from 'rollup';
import swc from '@rollup/plugin-swc';
import nodeResolve from '@rollup/plugin-node-resolve';

import { commonPlugins } from '../../rollup.config';
import { extractRollupPlugins } from './extract-rollup-plugins';

/**
 * Create an IIFE bundle for the browser environment.
 *
 * @param input The input file to bundle.
 * @param name The name of the output bundle.
 *
 * @returns The bundled code.
 *
 * @note Types can be used directly from the package.
 */
export const buildIife = async (input: string, name: string): Promise<string> => {
    const bundle = await rollup({
        input,
        plugins: [
            ...extractRollupPlugins(commonPlugins, ['json', 'alias', 'commonjs']),

            nodeResolve({
                extensions: ['.js', '.ts'],
                browser: true,
            }),

            swc(),
        ],
    });

    const { output } = await bundle.generate({
        format: 'iife',
        name,
    });

    const [chunk] = output;

    return chunk.code;
};
