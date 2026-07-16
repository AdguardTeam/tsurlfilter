import type { ExtendedCss, IAffectedElement } from '@adguard/extended-css';

// Type-only decls for symbols supplied by build-time inlining (see the
// inlineExtCssBundle plugin). Erased at runtime; they exist only so the source
// type-checks before the inliner swaps in the real definitions. The
// `import type` above is likewise erased — it provides the real library
// types instead of hand-rolled mirrors, without affecting `toString()`
// serialization.
// eslint-disable-next-line @typescript-eslint/naming-convention -- build-time marker, replaced by the inliner
declare function __INLINE_EXTCSS_BUNDLE__(): void;

/**
 * Build-time marker replaced by `tasks/inline-css-hits-helpers.ts`. The
 * inlined code defines a local `cssHitsHelpers` object (the SAME source as
 * MV2's `ElementUtils`) so the `beforeStyleApplied` callback below can call
 * `parseExtendedStyleInfo()` and `elementToString()` without any
 * module-scope references.
 */
// eslint-disable-next-line @typescript-eslint/naming-convention -- build-time marker, replaced by the inliner
declare function __INLINE_CSS_HITS_HELPERS__(): void;

/**
 * Inlined by `__INLINE_CSS_HITS_HELPERS__()` at build time. Type-only decl so
 * the source type-checks before the inliner swaps in the real object.
 */
declare const cssHitsHelpers: {
    parseExtendedStyleInfo: (
        content: string,
        marker: string,
    ) => { filterId: number; ruleIndex: number } | null;
    elementToString: (element: Element) => string;
};

/**
 * The apply IIFE entry: returns the applied ExtendedCss instance, accepts an
 * optional beforeStyleApplied callback (for CSS-hits stats).
 */
declare const applyExtendedCss: (
    cssRules: string[],
    beforeStyleApplied?: (el: IAffectedElement) => IAffectedElement,
) => ExtendedCss;

/**
 * Self-contained ExtendedCSS apply function injected into pages via
 * `chrome.scripting.executeScript({ func, args })`.
 *
 * NEVER called in the service worker — it is serialized by `toString()` and
 * re-evaluated in the page's ISOLATED world, so it MUST NOT reference any
 * outer-scope identifier: only literal source in this body (and `window`)
 * survives. The `inlineExtCssBundle` build plugin replaces the inlining
 * marker call below with the minified @adguard/extended-css apply IIFE, which
 * defines `applyExtendedCss` as a function-scoped `var`. Self-containment is
 * pinned by the `String(applyExtCss)` unit tests.
 *
 * @param cssRules ExtendedCSS rule strings to apply to the current document.
 * @param collectStats When true, register a CSS-hits `beforeStyleApplied`
 * callback (else nothing is registered and no overhead is incurred).
 */
export const applyExtCss = (cssRules: string[], collectStats = false): void => {
    __INLINE_EXTCSS_BUNDLE__();

    // Inlined CSS-hits helpers — the SAME source used by MV2's
    // `ElementUtils`. Defines a local `cssHitsHelpers` object with
    // `parseExtendedStyleInfo()` and `elementToString()` so the
    // `beforeStyleApplied` callback below can use them without any
    // module-scope references (which would not survive toString()-based
    // serialization for `chrome.scripting.executeScript({ func })`).
    __INLINE_CSS_HITS_HELPERS__();

    // Key must be a body literal, not a module-scope const: only body literals
    // survive toString() serialization — a module-scope const would be an
    // unresolved free identifier in the page's ISOLATED world.
    const w = window as unknown as Record<string, ExtendedCss | null | undefined>;

    // Dispose the previous instance before applying a new one. dispose()
    // disconnects the prior MutationObserver and reverts styles, preventing
    // stale observer/style leaks on same-document (SPA) re-injections (full
    // page loads tear down the world, so this only matters then).
    // eslint-disable-next-line @typescript-eslint/dot-notation -- bracket keeps the key a verbatim string literal
    const previous = w['__adguardExtCss'];
    if (previous) {
        try {
            previous.dispose();
        } catch {
            // Ignore disposal errors; the new instance is applied regardless.
        }
    }

    /**
     * CSS-hits callback. Uses the inlined `cssHitsHelpers` (defined above by
     * the build-time helpers inliner) — the SAME source as MV2's
     * `ElementUtils` — so both manifest versions share one implementation of
     * marker parsing and element serialization. The contract test
     * (test/lib/mv3/background/css-hits-protocol.test.ts) pins both paths to
     * identical outputs.
     *
     * @param el The affected element whose style is about to be applied.
     *
     * @returns The same element (with the hit marker content cleared).
     */
    const beforeStyleApplied = (el: IAffectedElement): IAffectedElement => {
        const PREFIX = 'adguard';
        const hits: { filterId: number; ruleIndex: number; element: string }[] = [];

        if (el && el.rules) {
            for (const rule of el.rules) {
                const content = rule && rule.style && rule.style.content;
                if (!content || content.indexOf(PREFIX) < 0) {
                    continue;
                }

                const ruleInfo = cssHitsHelpers.parseExtendedStyleInfo(content, PREFIX);
                if (!ruleInfo) {
                    continue;
                }

                const { filterId, ruleIndex } = ruleInfo;

                // Serialize element: build `<tagname attrs>` with a single
                // trailing '>'. Fall back to '<div>' when the node is missing
                // (mirrors the original inline implementation's fallback).
                const { node } = el;
                const elementStr = node
                    ? cssHitsHelpers.elementToString(node)
                    : '<div>';

                hits.push({ filterId, ruleIndex, element: elementStr });
                // Clear to avoid duplicate counting on re-style.
                if (rule.style) {
                    rule.style.content = '';
                }
            }
        }

        if (hits.length > 0) {
            // Defer the call into a microtask so a synchronous throw
            // (e.g. "Extension context invalidated" during extension
            // reload) becomes a caught rejection rather than escaping
            // into beforeStyleApplied → applyStyle → element hiding
            // disruption. An async sendMessage rejection (e.g.
            // "Receiving end does not exist") is also swallowed.
            Promise.resolve()
                .then(() => chrome.runtime.sendMessage({
                    handlerName: 'tsWebExtension',
                    type: 'saveCssHitsStats',
                    payload: hits,
                }))
                .catch(() => {
                    /* ignore */
                });
        }

        return el;
    };

    // Retain the new instance so the next call can dispose it.
    // eslint-disable-next-line @typescript-eslint/dot-notation -- bracket keeps the key a verbatim string literal
    w['__adguardExtCss'] = collectStats
        ? applyExtendedCss(cssRules, beforeStyleApplied)
        : applyExtendedCss(cssRules);
};
