import { existsSync } from 'node:fs';
import { dirname, resolve as resolvePath } from 'node:path';
import { fileURLToPath } from 'node:url';

import commonjs from '@rollup/plugin-commonjs';
import json from '@rollup/plugin-json';
import resolve from '@rollup/plugin-node-resolve';
import {
    type NormalizedOutputOptions,
    type OutputBundle,
    type Plugin,
    rollup,
} from 'rollup';
import { minify } from 'terser';
import ts from 'typescript';

// Entry point of the private injection payload: imports only the public root
// export of `@adguard/extended-css` — the consumer (this package) owns the
// IIFE, the library needs no consumer-specific subpaths. The path is declared
// once here (the entry is not a public export, so no package specifier can
// resolve it); the fail-fast check below catches moves/renames.
//
// NOTE: do NOT use `new URL(rel, import.meta.url)` here — Vite's dev-server
// transform rewrites that pattern to an `http://localhost` URL under Vitest,
// breaking `fileURLToPath`.
const EXT_CSS_INJECT_SRC = resolvePath(
    dirname(fileURLToPath(import.meta.url)),
    '../src/lib/mv3/background/extcss-inject-src.ts',
);

if (!existsSync(EXT_CSS_INJECT_SRC)) {
    throw new Error(
        `[inline-extcss-bundle] ExtendedCss inject entry source not found at ${EXT_CSS_INJECT_SRC}. `
        + 'If the file was moved or renamed, update the relative path in this file.',
    );
}

// Regex (not a plain string) so it survives downstream whitespace reformatting.
const MARKER_PATTERN = /__INLINE_EXTCSS_BUNDLE__\(\s*\)\s*;/;

// Any occurrence of this text in an emitted chunk means an un-inlined marker
// call (the `declare function` line is erased by TypeScript compilation).
const MARKER_NAME = '__INLINE_EXTCSS_BUNDLE__';

/**
 * TypeScript transpile plugin for the nested build: `ts.transpileModule`
 * only, no type checking (the package's `tsc` lint gate covers the entry
 * source). Mirrors `tasks/inline-css-hits-helpers.ts`.
 *
 * @returns Rollup plugin.
 */
const transpileTs = (): Plugin => ({
    name: 'inline-extcss-transpile-ts',
    transform(code: string, id: string): { code: string; map: null } | null {
        if (!id.endsWith('.ts')) {
            return null;
        }
        const { outputText } = ts.transpileModule(code, {
            compilerOptions: {
                target: ts.ScriptTarget.ES2022,
                module: ts.ModuleKind.ES2022,
            },
            fileName: id,
        });
        return { code: outputText, map: null };
    },
});

/**
 * Builds the private ExtendedCss injection payload: a minified,
 * self-contained IIFE assigning `applyExtendedCss` to a function-scoped `var`
 * when evaluated. Everything is bundled in memory — no temp files, no
 * published artifacts. No size ceiling is enforced: payload size is the
 * consumer's concern (the final application monitors its own bundle sizes).
 *
 * @returns Minified IIFE source.
 *
 * @throws Error if minification yields no code.
 */
export const buildExtCssBundle = async (): Promise<string> => {
    const build = await rollup({
        input: EXT_CSS_INJECT_SRC,
        external: [], // bundle everything, including @adguard/extended-css
        plugins: [
            transpileTs(),
            resolve({ browser: true, preferBuiltins: false }),
            commonjs(),
            json(),
        ],
    });
    try {
        const { output } = await build.generate({
            format: 'iife',
            name: 'applyExtendedCss',
            exports: 'default',
        });
        const [{ code }] = output;

        const minified = await minify(code, {
            format: { comments: false },
        });
        const result = minified.code ?? '';

        if (result.length === 0) {
            // An empty payload would inline silently and only fail at runtime
            // with `applyExtendedCss is not defined` in the page context.
            throw new Error('[inline-extcss-bundle] Minification produced an empty ExtendedCss IIFE.');
        }
        return result;
    } finally {
        // Do not leak the bundle handle in watch mode / long-lived test runs.
        await build.close();
    }
};

// Singleton: the nested build runs at most once per process; the result is
// shared by every plugin instance (build config, Vitest projects).
let bundlePromise: Promise<string> | undefined;

/**
 * Returns the cached ExtendedCss injection IIFE, building it on first use.
 *
 * @returns Promise resolving to the minified IIFE source.
 */
export const getExtCssBundle = (): Promise<string> => {
    if (bundlePromise === undefined) {
        bundlePromise = buildExtCssBundle();
    }
    return bundlePromise;
};

/**
 * Replaces the `__INLINE_EXTCSS_BUNDLE__()` marker call with the payload
 * IIFE. Must run after TypeScript compilation so the type checker never sees
 * the inlined `var applyExtendedCss` alongside the type-only `declare const`.
 *
 * @returns Rollup/Vite plugin.
 */
export const inlineExtCssBundle = (): Plugin => ({
    name: 'inline-extcss-bundle',

    // Warm the cache so the async nested build overlaps with the rest of
    // the pipeline; Vite dev servers (Vitest) also await async buildStart hooks.
    async buildStart(): Promise<void> {
        await getExtCssBundle();
    },

    async transform(code: string, id: string): Promise<string | null> {
        // The marker call is the contract — no hardcoded owner-module path,
        // so renames/moves don't touch this task. Test files are excluded:
        // they may embed the marker literal in assertions.
        if (id.includes('.test.ts') || !MARKER_PATTERN.test(code)) {
            return null;
        }

        // Await the cache here too, so pipelines that skip buildStart still work.
        const source = await getExtCssBundle();
        // Replacer fn (not a string) so `$`-patterns emit verbatim.
        return code.replace(MARKER_PATTERN, () => source);
    },

    // Production-build integrity net: fails the build on an un-inlined
    // marker. Vite dev servers (Vitest) never call this hook.
    generateBundle(_options: NormalizedOutputOptions, bundle: OutputBundle): void {
        for (const [fileName, item] of Object.entries(bundle)) {
            if (item.type === 'chunk' && item.code.includes(MARKER_NAME)) {
                // eslint-disable-next-line max-len
                const errMessage = `[inline-extcss-bundle] Un-inlined ${MARKER_NAME} marker in ${fileName}: the module containing the marker call was not transformed.`;
                this.error(errMessage);
                throw new Error(errMessage);
            }
        }
    },
});
