/**
 * @file
 * Entry point of the prebuilt ExtendedCss script asset.
 *
 * IMPORTANT: The file must be listed inside the `sideEffects` field in the
 * `package.json` of `@adguard/tswebextension`, because it exports nothing: it
 * only installs the ExtendedCss engine in the document's ISOLATED world.
 *
 * The background injects the built file into a frame before the ExtendedCss
 * rules, so the extension must ship it under the path passed as
 * `settings.extCssScriptUrl`.
 */
import '@adguard/tswebextension/extcss-inject';
