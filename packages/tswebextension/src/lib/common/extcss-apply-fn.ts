import { type ExtendedCss, type IAffectedElement } from '@adguard/extended-css';

import { type ExtendedCssHit } from './content-script/utils/css-hits-helpers';
import { type ExtCssProtocol } from './extcss-protocol';

/**
 * Self-contained ExtendedCSS apply function shared by MV2 and MV3.
 *
 * In MV3 it is injected with
 * `chrome.scripting.executeScript({ func, args })`. In MV2 it is serialized
 * into a code string for `browser.tabs.executeScript({ code })`.
 *
 * NEVER called in the background — it is serialized by `toString()` and
 * re-evaluated in the page's ISOLATED world, so it MUST NOT reference any
 * outer-scope identifier: only literal source in this body (and `window`)
 * survives. The engine itself is NOT part of this body: the background first
 * injects the prebuilt `extcss-inject.js` script asset, which installs
 * `{ applyExtendedCss, cssHitsHelpers }` under `protocol.engineKey` in the
 * same ISOLATED world (see `extcss-engine.ts`). Every injection-boundary
 * literal (message handler name, message type, marker prefix, instance key,
 * engine key) arrives via the `protocol` argument — the shared
 * `EXTCSS_PROTOCOL` constant is the single source of truth. Self-containment
 * is pinned by the `String(extCssInjectedApply)` unit tests.
 *
 * A call whose rule strings match the ones the retained instance was built
 * from is a no-op: the instance is neither disposed nor rebuilt, so repeated
 * injections for the same document keep the engine state and the inline
 * styles the page applied in the meantime.
 *
 * @param cssRules ExtendedCSS rule strings to apply to the current document.
 * @param collectStats When true, register a CSS-hits `beforeStyleApplied`
 * callback (else nothing is registered and no overhead is incurred). The
 * callback is registered on every apply; the per-node dedupe state is
 * retained across applies, so a re-apply reports only the hits that were
 * not reported before.
 * @param protocol Serialized protocol values (see `EXTCSS_PROTOCOL`). A
 * required argument (not a module-scope default) so the serialized body has
 * zero free identifiers.
 *
 * @throws Error when the ExtendedCss engine asset was not injected into the
 * document first or was built by another package version, and the error that
 * made the new apply fail, after the previous rule strings have been
 * re-applied so the page stays protected.
 */
export const extCssInjectedApply = (
    cssRules: string[],
    collectStats: boolean,
    protocol: ExtCssProtocol,
): void => {
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

    const w = window as unknown as Record<string, unknown>;

    // The key arrives via `protocol` — a module-scope const would be an
    // unresolved free identifier in the page's ISOLATED world.
    const previous = w[protocol.instanceKey] as RetainedExtCss | null | undefined;
    const previousRules = previous?.cssRules;

    // Re-applying the rule strings the retained instance was built from is a
    // no-op: dispose() + apply() would rebuild an identical instance, revert
    // the inline styles the page changed since the previous apply, and re-walk
    // the DOM for nothing. The background records an applied rule set and
    // skips it, but a frame with no context has no state to record, and the
    // content script can ask for its data again, so the payload still guards
    // itself. The rules encode the hits flag (markers are added when
    // statistics are collected), so an unchanged rule set also means an
    // unchanged callback registration.
    //
    // The check runs before the engine is read, so a repeated call
    // stays a pure no-op and never touches the engine state.
    if (
        previousRules
        && previousRules.length === cssRules.length
        && previousRules.every((rule, index) => rule === cssRules[index])
    ) {
        return;
    }

    /**
     * Engine installed by the prebuilt script asset. The background injects
     * the asset right before this function, so a missing engine means the
     * asset could not be loaded — or the document navigated between the two
     * injections, in which case this document never received it. Applying the
     * rules is impossible in both cases, and applying stale rules must not
     * happen, so the call fails loudly instead.
     */
    const engine = window[protocol.engineKey];

    if (!engine) {
        throw new Error('ExtendedCss engine is not loaded: inject the extcss script asset first');
    }

    // A stale copy of the asset — one shipped by another package version —
    // would run an older engine next to the current background code. Fail
    // loudly instead, so the mismatch is diagnosable instead of silent.
    if (engine.version !== protocol.engineVersion) {
        const mismatch = `ExtendedCss engine version mismatch: asset ${engine.version}, `
            + `expected ${protocol.engineVersion}; `
            + 'ship the asset from the same package version';

        throw new Error(mismatch);
    }

    // The CSS-hits helpers — the SAME source used by MV2's `ElementUtils` and
    // `CssHitsCounter` — arrive with the engine asset, so they are reachable
    // here without any module-scope reference (which would not survive
    // toString()-based serialization for
    // `chrome.scripting.executeScript({ func })`).
    const { applyExtendedCss, cssHitsHelpers } = engine;

    // The helpers keep no state between injections, so the dedupe map
    // is created here, retained on the instance and passed explicitly. Nodes
    // reported before a re-apply are skipped, while nodes matched for the
    // first time by the new instance are still reported.
    const countedHits = previous?.countedHits ?? new WeakMap<Element, Set<string>>();

    /**
     * Marker-stripped copies of the parsed rules, keyed by the original rule.
     * ExtendedCss keys its `appliedRules` fast path on rule object identity,
     * so the callback must return the same copy on every mutation pass.
     */
    const cleanedRules = new WeakMap<
        IAffectedElement['rules'][number],
        IAffectedElement['rules'][number]
    >();

    /**
     * Elements removed by a `:remove()` rule of this or a previous apply.
     * Retained on `window` — the injected function shares the document's
     * ISOLATED world with the content script — so the content-script
     * `CssHitsCounter` does not put them back into the page as probes.
     */
    const removedElements = window[protocol.removedElementsKey] ?? new WeakSet<Element>();
    window[protocol.removedElementsKey] = removedElements;

    /**
     * Hits collected by {@link beforeStyleApplied} during the current apply
     * batch, reported to the background in one message.
     *
     * `beforeStyleApplied` runs once per affected element, so reporting each
     * call on its own would send one message per matched element on a heavy
     * page. The hits are accumulated and flushed once per microtask batch
     * instead: the whole synchronous `apply()` pass becomes one message, while
     * hits matched later by the `MutationObserver` are still reported.
     */
    const pendingHits: ExtendedCssHit[] = [];

    /**
     * Whether a {@link flushHits} call is already scheduled for the current
     * batch.
     */
    let flushScheduled = false;

    /**
     * Reports the hits accumulated so far to the background in a single
     * message and starts a new batch.
     *
     * @returns The `sendMessage` result, so the caller can swallow both a
     * synchronous throw and an async rejection.
     */
    const flushHits = (): unknown => {
        flushScheduled = false;

        const payload = pendingHits.splice(0, pendingHits.length);

        return chrome.runtime.sendMessage({
            handlerName: protocol.handlerName,
            type: protocol.messageType,
            payload,
        });
    };

    /**
     * CSS-hits callback. Uses the `cssHitsHelpers` installed by the engine
     * asset — the SAME source that MV2's `CssHitsCounter` uses — so both
     * manifest versions collect hits one way. The behavior tests in
     * `extcss-apply-fn.test.ts` cover this path.
     *
     * @param el The affected element whose style is about to be applied.
     *
     * @returns The same element (with the hit marker content cleared).
     */
    const beforeStyleApplied = (el: IAffectedElement): IAffectedElement => {
        // ExtendedCss removes the node itself for `:remove()` rules, and it
        // calls this callback first. Record the node before that, so the
        // counter does not queue it as a probe and put it back into the page.
        if (el.rules) {
            for (const rule of el.rules) {
                if (rule.style?.remove === 'true') {
                    removedElements.add(el.node);
                }
            }
        }

        const hits = cssHitsHelpers.collectExtendedCssHits(
            el,
            protocol.markerPrefix,
            true,
            countedHits,
            cleanedRules,
        );

        if (hits.length > 0) {
            pendingHits.push(...hits);

            if (!flushScheduled) {
                flushScheduled = true;

                // Defer the call into a microtask so a synchronous throw
                // (e.g. "Extension context invalidated" during extension
                // reload) becomes a caught rejection rather than escaping
                // into beforeStyleApplied → applyStyle → element hiding
                // disruption. An async sendMessage rejection (e.g.
                // "Receiving end does not exist") is also swallowed.
                Promise.resolve()
                    .then(flushHits)
                    .catch(() => {
                        /* ignore */
                    });
            }
        }

        return el;
    };

    // Dispose the previous instance BEFORE applying a new one: dispose()
    // reverts its elements to the `cssText` they had before, so the new instance
    // snapshots clean `originalStyle` values (a disposal after the apply would
    // otherwise resurrect the previous instance's inline styles later). Its
    // rule strings are kept aside (`previousRules`) and re-applied if the new
    // apply throws, so a failed apply never leaves the page without ExtendedCss
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
 * Self-contained ExtendedCSS disposal function shared by MV2 and MV3.
 *
 * In MV3 it is injected with `chrome.scripting.executeScript({ func, args })`.
 * In MV2 it is serialized into a code string for
 * `browser.tabs.executeScript({ code })`. It runs when the rule set is empty
 * and disposes the previously retained ExtendedCss instance (if any):
 * disconnects its MutationObserver and reverts its styles, so stale observers
 * and styles do not leak. The disposal is unconditional — a caller cannot tell
 * whether the document still holds an instance — and is a no-op when it does
 * not.
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
