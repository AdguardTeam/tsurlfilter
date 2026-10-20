import { type ExtendedCss, type IAffectedElement } from '@adguard/extended-css';

import type { cssHitsHelpers as cssHitsHelpersImpl } from '../../common/content-script/utils/css-hits-helpers';
import { type ExtCssProtocol } from '../../common/message-constants';

import type applyExtendedCssImpl from './extcss-inject-src';

// Type-only decls for symbols supplied by build-time inlining (see the
// inlineExtCssBundle plugin). Erased at runtime; they exist only so the source
// type-checks before the inliner swaps in the real definitions. The
// `import type` declarations above are likewise erased — they provide the real
// module types instead of hand-rolled mirrors, without affecting `toString()`
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
declare const cssHitsHelpers: typeof cssHitsHelpersImpl;

/**
 * The apply IIFE entry: returns the applied ExtendedCss instance, accepts an
 * optional beforeStyleApplied callback (for CSS-hits stats).
 */
declare const applyExtendedCss: typeof applyExtendedCssImpl;

/**
 * Self-contained ExtendedCSS apply function injected into pages via
 * `chrome.scripting.executeScript({ func, args })`.
 *
 * NEVER called in the service worker — it is serialized by `toString()` and
 * re-evaluated in the page's ISOLATED world, so it MUST NOT reference any
 * outer-scope identifier: only literal source in this body (and `window`)
 * survives. The `inlineExtCssBundle` build plugin replaces the inlining
 * marker call below with the private minified ExtendedCss apply IIFE (built
 * in-memory from the library's public root export), which defines
 * `applyExtendedCss` as a function-scoped `var`. Every injection-boundary
 * literal (message handler name, message type, marker prefix, instance key)
 * arrives via the `protocol` argument — the shared `EXTCSS_PROTOCOL`
 * constant is the single source of truth. Self-containment is pinned by the
 * `String(extCssInjectedApply)` unit tests.
 *
 * @param cssRules ExtendedCSS rule strings to apply to the current document.
 * @param collectStats When true, register a CSS-hits `beforeStyleApplied`
 * callback (else nothing is registered and no overhead is incurred).
 * @param protocol Serialized protocol values (see `EXTCSS_PROTOCOL`). A
 * required argument (not a module-scope default) so the serialized body has
 * zero free identifiers.
 *
 * @throws The error that made the new apply fail, after the previous rule
 * strings have been re-applied so the page stays protected.
 */
export const extCssInjectedApply = (
    cssRules: string[],
    collectStats: boolean,
    protocol: ExtCssProtocol,
): void => {
    __INLINE_EXTCSS_BUNDLE__();

    // Inlined CSS-hits helpers — the SAME source used by MV2's
    // `ElementUtils`. Defines a local `cssHitsHelpers` object with
    // `parseExtendedStyleInfo()` and `elementToString()` so the
    // `beforeStyleApplied` callback below can use them without any
    // module-scope references (which would not survive toString()-based
    // serialization for `chrome.scripting.executeScript({ func })`).
    __INLINE_CSS_HITS_HELPERS__();

    /**
     * Retained ExtendedCss instance together with the rule strings it was
     * built from. The rule strings are kept so a failed re-apply can rebuild
     * the previous instance instead of leaving the page unprotected.
     */
    type RetainedExtCss = ExtendedCss & { cssRules?: string[] };

    const w = window as unknown as Record<string, RetainedExtCss | null | undefined>;

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
        const PREFIX = protocol.markerPrefix;
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
                    handlerName: protocol.handlerName,
                    type: protocol.messageType,
                    payload: hits,
                }))
                .catch(() => {
                    /* ignore */
                });
        }

        return el;
    };

    // Dispose the previous instance BEFORE applying a new one: dispose()
    // reverts its elements to their pre-ExtCSS `cssText`, so the new instance
    // snapshots clean `originalStyle` values (a disposal after the apply would
    // otherwise resurrect the previous instance's inline styles later). Its
    // rule strings are kept aside and re-applied if the new apply throws, so a
    // failed apply never leaves the page without ExtendedCSS filtering until
    // the next navigation. The key arrives via `protocol` — a module-scope
    // const would be an unresolved free identifier in the page's ISOLATED
    // world.
    const previous = w[protocol.instanceKey];
    const previousRules = previous?.cssRules;

    if (previous) {
        try {
            previous.dispose();
        } catch {
            // Ignore disposal errors; the new instance is applied regardless.
        }
    }

    try {
        // Retain the new instance, and the rule strings it was built from, so
        // the next call can dispose it and restore it on failure.
        const next: RetainedExtCss = collectStats
            ? applyExtendedCss(cssRules, beforeStyleApplied)
            : applyExtendedCss(cssRules);
        next.cssRules = cssRules;
        w[protocol.instanceKey] = next;
    } catch (e) {
        // Rebuild the previous instance from its retained rule strings. No
        // `beforeStyleApplied` callback is registered on the restored instance
        // to avoid reporting the same hits twice.
        if (previousRules && previousRules.length > 0) {
            try {
                const restored: RetainedExtCss = applyExtendedCss(previousRules);
                restored.cssRules = previousRules;
                w[protocol.instanceKey] = restored;
            } catch {
                // Nothing else can be done in the page context.
            }
        }
        throw e;
    }
};

/**
 * Self-contained ExtendedCSS disposal function injected into pages via
 * `chrome.scripting.executeScript({ func, args })` when the rule set
 * transitions from non-empty to empty (or null) on a same-document
 * navigation. Disposes the previously retained ExtendedCss instance (if
 * any): disconnects its MutationObserver and reverts its styles, so stale
 * observers and styles do not leak.
 *
 * Like {@link extCssInjectedApply}, it MUST NOT reference any outer-scope
 * identifier; the instance key arrives via the `protocol` argument.
 *
 * @param protocol Serialized protocol values (see `EXTCSS_PROTOCOL`); only
 * `instanceKey` is used.
 */
export const extCssInjectedDispose = (protocol: ExtCssProtocol): void => {
    const w = window as unknown as Record<string, { dispose(): void } | null | undefined>;
    const previous = w[protocol.instanceKey];
    if (previous) {
        try {
            previous.dispose();
        } catch {
            // Ignore disposal errors; the key is cleared regardless.
        }
        w[protocol.instanceKey] = null;
    }
};
