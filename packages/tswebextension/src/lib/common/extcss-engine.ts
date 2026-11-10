/**
 * @file
 * Entry point of the prebuilt `extcss-inject.js` script asset.
 *
 * IMPORTANT: This file should be listed inside the `sideEffects` field in the
 * `package.json`, because it exports nothing to the outside: it only installs
 * the ExtendedCss engine on the document's ISOLATED world.
 *
 * The asset is built by a dedicated Rollup entry (see `rollup.config.ts`) into
 * a single self-contained file, minified and bundled with
 * `@adguard/extended-css`. MV2 and MV3 inject that file with the scripting
 * API before they inject the rule strings, so the engine is loaded once per
 * apply instead of being carried inside every apply payload.
 *
 * Schema:
 * - Buildtime:
 *   -- [tswebext] This file is the asset entry: it bundles the engine and the
 *      CSS-hits helpers. <--- current file.
 * - Runtime:
 *   -- [extension] Copies the built asset into the extension and passes its
 *      path as `settings.extCssScriptUrl`.
 *   -- [tswebext] Injects the asset file into the frame, then injects
 *      `extCssInjectedApply` with the rule strings.
 *
 * Reference code: EXTCSS_ENGINE.
 */
import { cssHitsHelpers } from './content-script/utils/css-hits-helpers';
import applyExtendedCss from './extcss-inject-src';
import { EXTCSS_ENGINE_KEY, type ExtCssEngine } from './extcss-protocol';

/**
 * Engine payload the injected apply function reads back from the document's
 * ISOLATED world.
 */
const engine: ExtCssEngine = {
    applyExtendedCss,
    cssHitsHelpers,
};

window[EXTCSS_ENGINE_KEY] = engine;
