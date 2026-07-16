import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { type Plugin } from 'rollup';

// Resolved via the package's `exports` map (`"./apply"` subpath).
const EXT_CSS_BUNDLE_PATH = fileURLToPath(
    import.meta.resolve('@adguard/extended-css/apply'),
);

// Regex (not a plain string) so it survives downstream whitespace reformatting.
const MARKER_PATTERN = /__INLINE_EXTCSS_BUNDLE__\(\s*\)\s*;/;
const MODULE_ID_FRAGMENT = 'extcss-apply-fn.ts';

/**
 * Inlines the minified `@adguard/extended-css` apply IIFE into the
 * `applyExtCss` function body, replacing the `__INLINE_EXTCSS_BUNDLE__()`
 * marker. Must run after TypeScript compilation so the type checker never
 * sees the inlined `var applyExtendedCss` alongside the type-only
 * `declare const`.
 *
 * @returns Rollup/Vite plugin.
 */
export const inlineExtCssBundle = (): Plugin => {
    let bundle: string | undefined;

    return {
        name: 'inline-extcss-bundle',
        transform(code: string, id: string): string | null {
            const isOwnerModule = id.includes(MODULE_ID_FRAGMENT) && !id.includes('.test.ts');
            const hasMarker = MARKER_PATTERN.test(code);
            if (!isOwnerModule || !hasMarker) {
                return null;
            }

            if (bundle === undefined) {
                bundle = readFileSync(EXT_CSS_BUNDLE_PATH, 'utf8');
            }
            const source = bundle;
            // Replacer fn (not a string) so `$`-patterns in the bundle emit
            // verbatim rather than being interpreted as substitutions.
            return code.replace(MARKER_PATTERN, () => source);
        },
    };
};
