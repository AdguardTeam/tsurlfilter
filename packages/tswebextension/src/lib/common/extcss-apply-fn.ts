import { type ExtendedCss, type IAffectedElement } from '@adguard/extended-css';

import { type ExtendedCssHit } from './content-script/utils/css-hits-helpers';
import { type ExtCssApplySuccess, type ExtCssInjectionResult, type ExtCssProtocol } from './extcss-protocol';

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
 * The replacement is fail-closed when the retained instance cannot be
 * disposed: the new rules are NOT applied, because the stale instance would
 * become unreachable while its styles or observer stay active. A permanently
 * failing `dispose()` therefore leaves the replacement rules unapplied for
 * that document until navigation instead of claiming a success the page does
 * not have.
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
 * @returns The {@link ExtCssApplySuccess} sentinel when the rules are applied
 * or the call is an in-page no-op; an explicit failure when the engine is
 * missing or has another version. Returning the sentinel and the guard
 * failures lets the background tell a completed apply from an in-page
 * exception, which Chromium also reports as a `null` result.
 *
 * @throws The error that made the new apply fail, after the previous rule
 * strings have been re-applied so the page stays protected.
 */
export const extCssInjectedApply = (
    cssRules: string[],
    collectStats: boolean,
    protocol: ExtCssProtocol,
): ExtCssInjectionResult => {
    /**
     * Retained ExtendedCss instance together with the rule strings it was
     * built from. The rule strings are kept so a failed re-apply can rebuild
     * the previous instance instead of leaving the page unprotected. The
     * per-node hits dedupe state is NOT kept here: it lives on `window`
     * (see `protocol.countedHitsKey`), so dropping the instance cannot make
     * the next apply report the same hits again.
     */
    type RetainedExtCss = ExtendedCss & {
        cssRules?: string[];
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
        return true;
    }

    /**
     * Engine installed by the prebuilt script asset. The background injects
     * the asset right before this function, so a missing engine means the
     * asset could not be loaded — or the document navigated between the two
     * injections, in which case this document never received it. Applying the
     * rules is impossible in both cases, and applying stale rules must not
     * happen, so the call reports the failure to the background instead.
     */
    const engine = window[protocol.engineKey];

    if (!engine) {
        return {
            error: protocol.applyErrors.engineNotLoaded,
            message: 'ExtendedCss engine is not loaded: inject the extcss script asset first',
        };
    }

    // A stale copy of the asset — one shipped by another package version —
    // would run an older engine next to the current background code. Report it
    // to the background instead, so the mismatch is diagnosable instead of
    // silent.
    if (engine.version !== protocol.engineVersion) {
        const mismatch = `ExtendedCss engine version mismatch: asset ${engine.version}, `
            + `expected ${protocol.engineVersion}; `
            + 'ship the asset from the same package version';

        return {
            error: protocol.applyErrors.engineVersionMismatch,
            message: mismatch,
        };
    }

    // The CSS-hits helpers — the SAME source used by MV2's `ElementUtils` and
    // `CssHitsCounter` — arrive with the engine asset, so they are reachable
    // here without any module-scope reference (which would not survive
    // toString()-based serialization for
    // `chrome.scripting.executeScript({ func })`).
    const { applyExtendedCss, cssHitsHelpers } = engine;

    /**
     * Per-node reported hits of this document, kept on `window` rather than on
     * the retained instance: a failed apply, a failed restore or a failed
     * disposal can drop the instance, and the next apply must still skip the
     * pairs that were already reported. A disposal ends the filtering session
     * and removes the map, so a fresh session reports its hits again.
     */
    const countedHits = (w[protocol.countedHitsKey] as WeakMap<Element, Set<string>> | undefined)
        ?? new WeakMap<Element, Set<string>>();
    w[protocol.countedHitsKey] = countedHits;

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
        } catch (e) {
            // A failing dispose may have torn the instance down or left it
            // half-alive. The replacement is aborted, because applying on top
            // of the old instance would make it unreachable while its styles
            // or observer stay active. The rule metadata is dropped, so a later
            // request for the same rules applies for real instead of trusting
            // the instance, and the key is kept so a later disposal still
            // reaches it.
            //
            // The trade is deliberate and fail-closed: a permanently failing
            // `dispose()` keeps ExtendedCss filtering off for that document
            // until navigation instead of claiming a success the page does not
            // have.
            delete previous.cssRules;
            throw e;
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
        w[protocol.instanceKey] = next;
    } catch (e) {
        // Rebuild the previous instance from its retained rule strings. The
        // restored rules carry the same markers, so the callback is registered
        // too: the retained dedupe state skips the already reported hits while
        // elements matched from now on are still counted.
        let isRestored = false;

        if (previousRules && previousRules.length > 0) {
            try {
                const restored: RetainedExtCss = collectStats
                    ? applyExtendedCss(previousRules, beforeStyleApplied)
                    : applyExtendedCss(previousRules);
                restored.cssRules = previousRules;
                w[protocol.instanceKey] = restored;
                isRestored = true;
            } catch {
                // The restore failed too, so nothing protects the page.
            }
        }

        if (!isRestored) {
            // The retained object still names the previous rule strings even
            // though its instance is disposed or was never rebuilt. Drop the
            // key and its metadata, so a later request for those rules cannot
            // take the equal-rules no-op and skips the real apply.
            delete w[protocol.instanceKey];
        }

        throw e;
    }

    return true;
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
 * `instanceKey` and `countedHitsKey` are used.
 *
 * @returns The {@link ExtCssApplySuccess} sentinel after the disposal
 * completed.
 *
 * @throws The error that `dispose()` raised. The instance key and the
 * per-node dedupe map are kept, and the instance loses its rule metadata, so
 * the background reports the disposal as failed, a later disposal still
 * reaches the instance without re-reporting its hits, and a later apply for
 * the same rules cannot trust it.
 */
export const extCssInjectedDispose = (protocol: ExtCssProtocol): ExtCssApplySuccess => {
    const w = window as unknown as Record<string, {
        dispose(): void;
        cssRules?: string[];
    } | null | undefined>;
    const previous = w[protocol.instanceKey];

    if (previous) {
        try {
            // A throwing `dispose()` may have disconnected the observer before
            // it failed to revert the styles, so the error escapes and the key
            // is kept: the background reports a failure and a later disposal
            // still reaches the instance.
            previous.dispose();
        } catch (e) {
            // The instance is not trustworthy any more, so its rule metadata is
            // dropped: a later apply for the same rules applies for real
            // instead of taking the equal-rules no-op.
            delete previous.cssRules;
            throw e;
        }

        w[protocol.instanceKey] = null;
    }

    // A disposal ends the filtering session, so the next apply starts with a
    // fresh per-node dedupe map and reports its hits again. A failed disposal
    // keeps the map, because its retry still describes the same session.
    delete w[protocol.countedHitsKey];

    return true;
};
