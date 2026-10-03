import { readdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import commonjs from '@rollup/plugin-commonjs';
import resolve from '@rollup/plugin-node-resolve';
import swc from '@rollup/plugin-swc';
import { type Plugin, rollup } from 'rollup';
import { minify } from 'terser';

const MODULE_ID = 'virtual:canvas-engine';
const RESOLVED_MODULE_ID = `\0${MODULE_ID}`;
const ENGINE_DIRECTORY = path.resolve(
    path.dirname(fileURLToPath(import.meta.url)),
    '../src/lib/common/canvas-protection',
);

/**
 * The engine is bundled once per process and again after its sources change.
 */
let engineSource: Promise<string> | undefined;

/**
 * Bundles the page-world engine into one minified script without imports.
 * The background embeds this text, together with the session seed, into the
 * code it registers for the page world, so it has to be a self-contained string.
 *
 * @returns Source text that defines `canvasEngine`.
 */
const bundleCanvasEngine = async (): Promise<string> => {
    const bundle = await rollup({
        input: path.join(ENGINE_DIRECTORY, 'engine-entry.ts'),
        treeshake: { moduleSideEffects: false },
        plugins: [commonjs(), resolve({ browser: true, preferBuiltins: false, extensions: ['.ts', '.js'] }), swc({
            swc: { jsc: { target: 'es2022', parser: { syntax: 'typescript' } } },
        })],
    });
    try {
        const { output } = await bundle.generate({ format: 'iife', name: 'canvasEngine', exports: 'named' });
        const { code } = await minify(output[0].code, { format: { comments: false } });
        return code!;
    } finally {
        await bundle.close();
    }
};

/**
 * Serves the bundled page-world engine as the `virtual:canvas-engine` module,
 * for both the Rollup build and Vitest.
 *
 * @returns Rollup-compatible plugin.
 */
export function canvasEngineSource(): Plugin {
    return {
        name: 'canvas-engine-source',
        /**
         * Claims the virtual module.
         *
         * @param id Imported module name.
         *
         * @returns The internal module id, or `null` for other modules.
         */
        resolveId(id): string | null {
            return id === MODULE_ID ? RESOLVED_MODULE_ID : null;
        },
        /**
         * Rebuilds the engine after a watched source changes.
         */
        watchChange(): void {
            engineSource = undefined;
        },
        /**
         * Builds the module that exports the engine's source text.
         *
         * @param id Module id.
         *
         * @returns Module code, or `null` for other modules.
         */
        async load(id): Promise<string | null> {
            if (id !== RESOLVED_MODULE_ID) {
                return null;
            }
            const files = await readdir(ENGINE_DIRECTORY);
            files.forEach((file) => this.addWatchFile(path.join(ENGINE_DIRECTORY, file)));
            engineSource ??= bundleCanvasEngine();
            return `export default ${JSON.stringify(await engineSource)};`;
        },
    };
}
