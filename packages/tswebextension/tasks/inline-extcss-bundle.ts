import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, resolve } from 'node:path';

import { type Plugin } from 'rollup';

/**
 * `require` bound to this module's URL, used to resolve the
 * `@adguard/extended-css` package regardless of the `exports` map.
 */
const nodeRequire = createRequire(import.meta.url);

/**
 * Resolves the `@adguard/extended-css` package root directory.
 *
 * The package `exports` map does not expose `./package.json` or the apply
 * bundle subpath, so `require.resolve('@adguard/extended-css/package.json')`
 * throws `ERR_PACKAGE_PATH_NOT_EXPORTED`. Instead, resolve the main entry
 * (always exported) and walk up to the directory whose `package.json` name is
 * `@adguard/extended-css`.
 *
 * @returns Absolute path to the `@adguard/extended-css` package root.
 *
 * @throws {Error} When the package root cannot be located by walking up from
 * the resolved main entry.
 */
const resolveExtCssPackageRoot = (): string => {
    const mainEntry = nodeRequire.resolve('@adguard/extended-css');
    let dir = dirname(mainEntry);
    while (true) {
        try {
            const pkg = JSON.parse(readFileSync(resolve(dir, 'package.json'), 'utf8'));
            if (pkg.name === '@adguard/extended-css') {
                return dir;
            }
        } catch {
            // package.json not found at this level, keep walking up
        }
        const parent = dirname(dir);
        if (parent === dir) {
            throw new Error(
                'Could not locate @adguard/extended-css package root for ExtCSS bundle inlining',
            );
        }
        dir = parent;
    }
};

/**
 * Absolute path to the minified `@adguard/extended-css` apply IIFE produced by
 * issue 1-AFK.
 */
const EXT_CSS_BUNDLE_PATH = resolve(
    resolveExtCssPackageRoot(),
    'dist',
    'extended-css.apply.min.js',
);

let cachedBundle: string | undefined;

/**
 * Reads (and caches) the minified ExtendedCSS apply IIFE source.
 *
 * @returns The self-contained IIFE source that defines `applyExtendedCss`.
 */
export const getExtCssBundleSource = (): string => {
    if (cachedBundle === undefined) {
        cachedBundle = readFileSync(EXT_CSS_BUNDLE_PATH, 'utf8');
    }
    return cachedBundle;
};

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
 * The result is a self-contained function whose `toString()` carries the whole
 * engine, suitable for `chrome.scripting.executeScript({ func, args })`: the MV3
 * service-worker CSP (`script-src 'self'`) forbids `eval`/`new Function`, so the
 * engine must be inlined statically rather than imported and wrapped (closure
 * references do not survive `executeScript` serialization).
 *
 * The plugin must run *after* TypeScript compilation in the Rollup pipeline so
 * that the type checker never sees the inlined `var applyExtendedCss` alongside
 * the type-only `declare const applyExtendedCss` (which would be a redeclaration
 * error). In Vitest (esbuild, no type checking) the order is irrelevant.
 *
 * @returns Rollup/Vite plugin object.
 */
export const inlineExtCssBundle = (): Plugin => ({
    name: 'inline-extcss-bundle',
    transform(code: string, id: string): string | null {
        // Only touch the owner module (skip its test file).
        if (!id.includes(MODULE_ID_FRAGMENT) || id.includes('.test.ts')) {
            return null;
        }
        if (!MARKER_PATTERN.test(code)) {
            return null;
        }
        // A replacer function is used on purpose: the bundle source contains
        // `$&` (and other `$` patterns) inside its `escapeRegExp` utilities.
        // With a string replacement, `String.prototype.replace` would interpret
        // those as match/backreference substitutions and corrupt the inlined
        // engine. A function replacement emits the source verbatim.
        return code.replace(MARKER_PATTERN, () => getExtCssBundleSource());
    },
});
