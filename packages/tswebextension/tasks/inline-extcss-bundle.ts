import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { type Plugin } from 'rollup';

/**
 * Absolute path to the minified `@adguard/extended-css` apply IIFE.
 * Resolved via the package's `exports` map (`"./apply"` subpath), which
 * provides a versioned contract — no filesystem walk-up needed.
 */
const EXT_CSS_BUNDLE_PATH = fileURLToPath(
    import.meta.resolve('@adguard/extended-css/apply'),
);

/**
 * Marker call replaced at build time with the inlined ExtendedCSS apply IIFE.
 * Matched as a regex so it survives whitespace reformatting by downstream
 * plugins (e.g. `rollup-plugin-cleanup`).
 */
const MARKER_PATTERN = /__INLINE_EXTCSS_BUNDLE__\(\s*\)\s*;/;

/**
 * Suffix identifying the module that owns the `applyExtCss` function.
 */
const MODULE_ID_FRAGMENT = 'extcss-apply-fn.ts';

/**
 * Rollup/Vite plugin that inlines the minified `@adguard/extended-css` apply
 * IIFE into the `applyExtCss` function body, replacing the
 * `__INLINE_EXTCSS_BUNDLE__()` marker.
 *
 * `applyExtCss` is serialized via `toString()` and injected as a `func` into
 * `chrome.scripting.executeScript`, which strips all closure references. The
 * plugin must run after TypeScript compilation so the type checker never sees
 * the inlined `var applyExtendedCss` alongside the type-only `declare const`.
 *
 * @returns Rollup/Vite plugin object.
 */
export const inlineExtCssBundle = (): Plugin => {
    let cachedBundle: string | undefined;

    return {
        name: 'inline-extcss-bundle',
        transform(code: string, id: string): string | null {
            // Only touch the owner module (skip its test file), and only if
            // the marker is present.
            if ((!id.includes(MODULE_ID_FRAGMENT) || id.includes('.test.ts'))
                || !MARKER_PATTERN.test(code)
            ) {
                return null;
            }

            if (cachedBundle === undefined) {
                cachedBundle = readFileSync(EXT_CSS_BUNDLE_PATH, 'utf8');
            }

            // Replacer function (not string) so `$`-patterns in the bundle
            // source are emitted verbatim, not interpreted as substitutions.
            const bundleSource = cachedBundle;
            return code.replace(MARKER_PATTERN, () => bundleSource);
        },
    };
};
