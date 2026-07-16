import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { type Plugin } from 'rollup';
import ts from 'typescript';

const HELPERS_PATH = fileURLToPath(
    new URL('../src/lib/common/content-script/utils/css-hits-helpers.ts', import.meta.url),
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
const MODULE_ID_FRAGMENT = 'extcss-apply-fn.ts';

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
            const isOwnerModule = id.includes(MODULE_ID_FRAGMENT) && !id.includes('.test.ts');
            const hasMarker = MARKER_PATTERN.test(code);
            if (!isOwnerModule || !hasMarker) {
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
    };
};
