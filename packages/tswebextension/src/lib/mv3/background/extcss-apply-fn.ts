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
 * callback (else nothing is registered and no overhead is incurred). The
 * callback is registered on every injection; the per-node dedupe state is
 * retained across injections, so a re-apply reports only the hits that were
 * not reported before.
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
    // `ElementUtils` and `CssHitsCounter`. Defines a local `cssHitsHelpers`
    // object with `collectExtendedCssHits()` so the `beforeStyleApplied`
    // callback below can use it without any module-scope references (which
    // would not survive toString()-based serialization for
    // `chrome.scripting.executeScript({ func })`).
    __INLINE_CSS_HITS_HELPERS__();

    /**
     * Retained ExtendedCss instance together with the rule strings it was
     * built from and the per-node hits dedupe state. The rule strings are kept
     * so a failed re-apply can rebuild the previous instance instead of
     * leaving the page unprotected; the dedupe state is kept so a re-apply
     * does not report the same hits again.
     */
    type RetainedExtCss = ExtendedCss & {
        cssRules?: string[];
        countedHits?: WeakMap<Element, Set<string>>;
    };

    const w = window as unknown as Record<string, RetainedExtCss | null | undefined>;

    // The key arrives via `protocol` — a module-scope const would be an
    // unresolved free identifier in the page's ISOLATED world.
    const previous = w[protocol.instanceKey];
    const previousRules = previous?.cssRules;
    // The inlined helpers keep no state between injections, so the dedupe map
    // is created here, retained on the instance and passed explicitly. Nodes
    // reported before a re-apply are skipped, while nodes matched for the
    // first time by the new instance are still reported.
    const countedHits = previous?.countedHits ?? new WeakMap<Element, Set<string>>();

    /**
     * CSS-hits callback. Uses the inlined `cssHitsHelpers` (defined above by
     * the build-time helpers inliner) — the SAME source that MV2's
     * `CssHitsCounter` uses — so both manifest versions collect hits one way.
     * The contract test (test/lib/mv3/background/css-hits-protocol.test.ts)
     * pins both paths to identical outputs.
     *
     * @param el The affected element whose style is about to be applied.
     *
     * @returns The same element (with the hit marker content cleared).
     */
    const beforeStyleApplied = (el: IAffectedElement): IAffectedElement => {
        const hits = cssHitsHelpers.collectExtendedCssHits(
            el,
            protocol.markerPrefix,
            true,
            countedHits,
        );

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
    // rule strings are kept aside (`previousRules`) and re-applied if the new
    // apply throws, so a failed apply never leaves the page without ExtendedCSS
    // filtering until the next navigation.
    if (previous) {
        try {
            previous.dispose();
        } catch {
            // Ignore disposal errors; the new instance is applied regardless.
        }
    }

    try {
        // Retain the new instance, the rule strings it was built from, and the
        // dedupe state, so the next call can dispose it, restore it on
        // failure, and keep reporting only the hits that are new.
        const next: RetainedExtCss = collectStats
            ? applyExtendedCss(cssRules, beforeStyleApplied)
            : applyExtendedCss(cssRules);
        next.cssRules = cssRules;
        next.countedHits = countedHits;
        w[protocol.instanceKey] = next;
    } catch (e) {
        // Rebuild the previous instance from its retained rule strings. The
        // restored rules carry the same markers, so the callback is registered
        // too: the retained dedupe state skips the already reported hits while
        // elements matched from now on are still counted.
        if (previousRules && previousRules.length > 0) {
            try {
                const restored: RetainedExtCss = collectStats
                    ? applyExtendedCss(previousRules, beforeStyleApplied)
                    : applyExtendedCss(previousRules);
                restored.cssRules = previousRules;
                restored.countedHits = countedHits;
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
 * `chrome.scripting.executeScript({ func, args })` when the rule set is empty
 * for a document that already received an instance. Disposes the previously
 * retained ExtendedCss instance (if any): disconnects its MutationObserver and
 * reverts its styles, so stale observers and styles do not leak.
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
