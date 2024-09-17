/**
 * @file This is a small helper to build an IIFE bundle for the browser environment.
 *
 * @note It uses the main Rollup configuration from the root of the project.
 */
import { type Plugin, rollup } from 'rollup';
import swc from '@rollup/plugin-swc';
import nodeResolve from '@rollup/plugin-node-resolve';

import { commonPlugins } from '../../rollup.config';

/**
 * Get a plugin from a list of plugins.
 *
 * @param plugins The list of plugins.
 * @param name The name of the plugin to get.
 *
 * @returns The plugin instance or `undefined` if not found.
 */
const getPluginFromList = (plugins: Plugin[], name: string): Plugin | undefined => {
    return plugins.find((plugin) => plugin.name === name);
};

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
            // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
            getPluginFromList(commonPlugins, 'json')!,
            // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
            getPluginFromList(commonPlugins, 'alias')!,
            // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
            getPluginFromList(commonPlugins, 'commonjs')!,

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
