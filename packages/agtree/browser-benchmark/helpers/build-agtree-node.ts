/**
 * @file This is a small helper to build an IIFE bundle for the browser environment.
 *
 * @note It uses the main Rollup configuration from the root of the project.
 */
import { rollup } from 'rollup';
import path from 'path';
import nodeResolve from '@rollup/plugin-node-resolve';
import swc from '@rollup/plugin-swc';

import { commonPlugins } from '../../rollup.config';
import { extractRollupPlugins } from './extract-rollup-plugins';

/**
 * Create an AGTree bundle for Node.js environment.
 *
 * @returns The bundled code.
 *
 * @note Types can be used directly from the package.
 */
export const buildAgTreeForNode = async (): Promise<string> => {
    const bundle = await rollup({
        input: path.join(__dirname, '../../src/index.ts'),
        plugins: [
            ...extractRollupPlugins(commonPlugins, ['json', 'alias', 'commonjs', 'node-externals']),

            nodeResolve({
                extensions: ['.js', '.ts'],
            }),

            swc(),
        ],
    });

    const { output } = await bundle.generate({
        format: 'esm',
    });

    const [chunk] = output;

    return chunk.code;
};
