import commonjs from '@rollup/plugin-commonjs';
import json from '@rollup/plugin-json';
import resolve from '@rollup/plugin-node-resolve';
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
import { inlineCssHitsHelpers } from './tasks/inline-css-hits-helpers.ts';
// eslint-disable-next-line import/extensions -- see NOTE above
import { inlineExtCssBundle } from './tasks/inline-extcss-bundle.ts';

const BUILD_DIST = 'dist';

const commonPlugins: Plugin[] = [
    externals(),
    json(),
    typescript({ tsconfig: 'tsconfig.build.json' }),
    resolve({ preferBuiltins: false }),
    cleanup({ comments: ['srcmaps'] }),
    commonjs(),
    // Both inliners below MUST run after TypeScript so the type checker never
    // sees the inlined `applyExtendedCss` / `cssHitsHelpers` alongside the
    // type-only `declare const`. The two are independent — each replaces its
    // own marker in `extcss-apply-fn.ts` — so their relative order does not
    // matter, only that both come after `typescript()`.
    inlineExtCssBundle(),
    inlineCssHitsHelpers(),
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
        ...commonPlugins,
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
export default [tswebextensionConfig, typesConfig];
