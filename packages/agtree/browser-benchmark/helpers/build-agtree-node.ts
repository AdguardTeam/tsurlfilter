/**
 * @file This is a small helper to build an IIFE bundle for the browser environment.
 *
 * @note It uses the main Rollup configuration from the root of the project.
 */
import { rollup } from 'rollup';
import path from 'path';
import { fileURLToPath } from 'url';

import { getNodePlugins } from '../../rollup.config';

// eslint-disable-next-line @typescript-eslint/naming-convention, no-underscore-dangle
const __dirname = path.dirname(fileURLToPath(import.meta.url));

/**
 * Create an AGTree bundle for Node.js environment.
 *
 * @returns The bundled code.
 *
 * @note Types can be used directly from the package.
 */
export const buildAgTreeForNode = async (): Promise<string> => {
    const bundle = await rollup({
        input: path.join(__dirname, '..', '..', 'src', 'index.ts'),
        plugins: getNodePlugins(true),
    });

    const { output } = await bundle.generate({
        format: 'esm',
    });

    const [chunk] = output;

    return chunk.code;
};
