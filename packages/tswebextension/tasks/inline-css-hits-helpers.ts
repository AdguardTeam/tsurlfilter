import { existsSync, readFileSync } from 'node:fs';
import { dirname, resolve as resolvePath } from 'node:path';
import { fileURLToPath } from 'node:url';

import { type NormalizedOutputOptions, type OutputBundle, type Plugin } from 'rollup';
import ts from 'typescript';

// NOTE: do NOT use `new URL(rel, import.meta.url)` here — Vite's dev-server
// transform rewrites that pattern to an `http://localhost` URL under Vitest,
// breaking `fileURLToPath`. This module is imported directly by the builder
// test, so the same constraint as in `tasks/inline-extcss-bundle.ts` applies.
const HELPERS_PATH = resolvePath(
    dirname(fileURLToPath(import.meta.url)),
    '../src/lib/common/content-script/utils/css-hits-helpers.ts',
);

// Fail fast: if the helpers source is moved or renamed, surface a clear error at
// config-load time instead of a cryptic ENOENT deep in the transform hook.
if (!existsSync(HELPERS_PATH)) {
    throw new Error(
        `[inline-css-hits-helpers] Helpers source not found at ${HELPERS_PATH}. `
        + 'If the file was moved or renamed, update the relative path in this file.',
    );
}

// Regex (not a plain string) so it survives downstream whitespace reformatting.
const MARKER_PATTERN = /__INLINE_CSS_HITS_HELPERS__\(\s*\)\s*;/;

// Any occurrence of this text in an emitted chunk means an un-inlined marker
// call (the `declare function` line is erased by TypeScript compilation).
const MARKER_NAME = '__INLINE_CSS_HITS_HELPERS__';

/**
 * Transpiles the helpers module to self-contained JS — no imports, no exports.
 * The only import (`RuleInfoBasic`) is type-only and already erased, so the
 * result has no free identifiers and can be inlined into `applyExtCss`,
 * whose body is serialized via `toString()` for `executeScript`.
 *
 * @returns Transpiled JavaScript source.
 */
function buildHelpersSource(): string {
    const { outputText } = ts.transpileModule(readFileSync(HELPERS_PATH, 'utf8'), {
        compilerOptions: {
            target: ts.ScriptTarget.ES2022,
            module: ts.ModuleKind.ES2022,
            // Strip comments: the transpiled source is inlined into the
            // injected `applyExtCss` body, so every byte counts — and stray
            // comment text (e.g. `'adguard'` examples) must not pollute the
            // self-containment contract of the serialized function.
            removeComments: true,
        },
    });
    return outputText.replace(/export\s*\{[^}]*\}\s*;?/g, '').trimEnd();
}

/**
 * Inlines the CSS-hits helpers into the `applyExtCss` function body, replacing
 * the `__INLINE_CSS_HITS_HELPERS__()` marker. This lets MV2 (runtime import)
 * and MV3 (build-time inline) share one source file. Must run after TypeScript
 * compilation so the type checker never sees the inlined code.
 *
 * @returns Rollup/Vite plugin.
 */
export const inlineCssHitsHelpers = (): Plugin => {
    let helpers: string | undefined;

    return {
        name: 'inline-css-hits-helpers',

        transform(code: string, id: string): string | null {
            // The marker call is the contract — no hardcoded owner-module path,
            // so renames/moves don't touch this task. Test files are excluded:
            // they may embed the marker literal in assertions.
            if (id.includes('.test.ts') || !MARKER_PATTERN.test(code)) {
                return null;
            }

            if (helpers === undefined) {
                helpers = buildHelpersSource();
            }
            const source = helpers;
            // Replacer fn (not a string) so `$`-patterns in the helpers emit
            // verbatim rather than being interpreted as substitutions.
            return code.replace(MARKER_PATTERN, () => source);
        },

        // Production-build integrity net: fails the build on an un-inlined
        // marker. Vite dev servers (Vitest) never call this hook.
        generateBundle(_options: NormalizedOutputOptions, bundle: OutputBundle): void {
            for (const [fileName, item] of Object.entries(bundle)) {
                if (item.type === 'chunk' && item.code.includes(MARKER_NAME)) {
                    throw new Error(
                        `[inline-css-hits-helpers] Un-inlined ${MARKER_NAME} marker in ${fileName}: `
                        + 'the module containing the marker call was not transformed.',
                    );
                }
            }
        },
    };
};
