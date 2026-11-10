import commonjs from '@rollup/plugin-commonjs';
import json from '@rollup/plugin-json';
import resolve from '@rollup/plugin-node-resolve';
import terser from '@rollup/plugin-terser';
import typescript from '@rollup/plugin-typescript';
import { omit } from 'lodash-es';
import { type Plugin, type RollupOptions } from 'rollup';
import cleanup from 'rollup-plugin-cleanup';
import dts from 'rollup-plugin-dts';
import externals from 'rollup-plugin-node-externals';

// NOTE: explicit `.ts` extension is required because Rollup's config bundler
// (loaded via `--configPlugin @rollup/plugin-swc`) resolves exact file paths but
// does not append the `.ts` extension to extensionless specifiers.
// eslint-disable-next-line import/extensions -- see NOTE above
import { canvasEngineSource } from './tasks/canvas-engine-plugin.ts';

const BUILD_DIST = 'dist';

const commonPlugins: Plugin[] = [
    externals(),
    json(),
    typescript({ tsconfig: 'tsconfig.build.json' }),
    resolve({ preferBuiltins: false }),
    cleanup({ comments: ['srcmaps'] }),
    commonjs(),
];

/**
 * These files should be marked as via side effects in package.json.
 *
 * NOTE: If you update list here, please update related section in the readme.
 */
const entryPointsWithSideEffects = {
    'assistant-inject': 'src/lib/common/content-script/assistant/assistant-inject.ts',
    'content-script': 'src/lib/mv2/content-script/index.ts',
    'content-script.mv3': 'src/lib/mv3/content-script/index.ts',
    'gpc.mv3': 'src/lib/mv3/content-script/gpc.ts',
    'hide-document-referrer.mv3': 'src/lib/mv3/content-script/hide-document-referrer.ts',
};

const entryPoints = {
    index: 'src/lib/mv2/background/index.ts',
    'index.mv3': 'src/lib/mv3/background/index.ts',
    'css-hits-counter': 'src/lib/common/content-script/css-hits-counter.ts',
    cli: 'src/cli/index.ts',
    'mv3-utils': 'src/lib/mv3/utils/index.ts',
    'filters-storage': 'src/lib/common/storage/public-filters.ts',
};

const tswebextensionConfig: RollupOptions = {
    cache: false,
    input: {
        ...entryPoints,
        ...entryPointsWithSideEffects,
    },
    output: [
        {
            dir: BUILD_DIST,
            format: 'esm',
            entryFileNames: '[name].js',
            chunkFileNames: 'common/[name].js',
            exports: 'named',
            preserveModulesRoot: 'src',
            manualChunks: {
                'trackers-min': ['src/lib/common/companies-db-service/trackers-min.ts'],
            },
        },
    ],
    treeshake: {
        /**
         * To avoid leftovers in the code when you access a property without side effects,
         * like below:
         * ```js
         * Fingerprintjs3Names[0];
         * ```.
         */
        propertyReadSideEffects: false,
        /**
         * This option prevent of the following import:
         * ```
         * import '@adguard/text-encoding';
         * ```.
         */
        moduleSideEffects: false,
    },
    plugins: [
        canvasEngineSource(),
        ...commonPlugins,
    ],
};

/**
 * Builds the prebuilt ExtendedCss injection script asset.
 *
 * The asset is a single self-contained IIFE: it bundles `@adguard/extended-css`
 * and the CSS-hits helpers, then installs them on the document's ISOLATED
 * world under the key the injected apply function reads (`EXTCSS_ENGINE_KEY`).
 * MV2 and MV3 inject the file with the scripting API before they inject the
 * rule strings, so the engine stops traveling inside every apply payload and
 * the payload satisfies the service-worker CSP.
 *
 * The asset is minified because it is injected into every frame that has
 * ExtendedCss rules, and because the previous inlined payload was minified as
 * well; the rest of `dist` stays unminified.
 */
const extCssAssetConfig: RollupOptions = {
    input: 'src/lib/common/extcss-engine.ts',
    output: {
        file: `${BUILD_DIST}/extcss-inject.js`,
        format: 'iife',
    },
    plugins: [
        json(),
        typescript({ tsconfig: 'tsconfig.build.json' }),
        resolve({ preferBuiltins: false }),
        commonjs(),
        terser(),
    ],
};

const typesConfig: RollupOptions = {
    // omit entry points that are not exporting types
    input: omit(entryPoints, ['content-script.mv3', 'gpc', 'hide-document-referrer']),
    output: {
        dir: `${BUILD_DIST}/types`,
        format: 'esm',
        exports: 'named',
        preserveModules: true,
        preserveModulesRoot: 'src',
    },
    plugins: [
        externals(),
        dts(),
    ],
};

// TODO: Remove index files from 'src/lib', 'src/lib/mv2', 'src/lib/mv3' because
// they are not participating in the build process and not specified as entry points.
export default [tswebextensionConfig, extCssAssetConfig, typesConfig];
