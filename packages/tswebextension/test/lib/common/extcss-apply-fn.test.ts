/**
 * @vitest-environment jsdom
 */

import {
    afterEach,
    beforeEach,
    describe,
    expect,
    it,
    vi,
} from 'vitest';

// Installs the engine the way the background does: the prebuilt script asset
// goes into the document before the rule strings.
import '../../../src/lib/common/extcss-engine';

import { extCssInjectedApply, extCssInjectedDispose } from '../../../src/lib/common/extcss-apply-fn';
import { EXTCSS_PROTOCOL, type ExtCssProtocol } from '../../../src/lib/common/extcss-protocol';

import { resetExtCssState } from './helpers';

// Single file-level cleanup. The jsdom `window` is shared across every test in
// this file, so a retained ExtendedCss instance (and its MutationObserver)
// would leak into the next test.
afterEach(() => {
    resetExtCssState();
});

/**
 * Rebuilds the injected function from its serialized source, the way
 * `chrome.scripting.executeScript({ func })` does, so a module-scope
 * reference in the body fails with a `ReferenceError` here too.
 *
 * @returns A fresh copy of {@link extCssInjectedApply} with no closure.
 */
const createSerializedApply = (): typeof extCssInjectedApply => {
    // eslint-disable-next-line no-new-func, @typescript-eslint/no-implied-eval
    return new Function(`return (${String(extCssInjectedApply)});`)() as typeof extCssInjectedApply;
};

describe('extCssInjectedApply (prebuilt engine asset)', () => {
    it('hides a matching :has() element after being called', () => {
        document.body.innerHTML = '<div class="ad"><span class="child">ad</span></div>';

        createSerializedApply()(['.ad:has(.child) { display: none !important; }'], false, EXTCSS_PROTOCOL);

        const ad = document.querySelector('.ad') as HTMLElement;
        expect(ad.style.getPropertyValue('display')).toBe('none');
        expect(ad.style.getPropertyPriority('display')).toBe('important');
    });

    it('hides a matching :contains() element', () => {
        // `:contains()` reads the page's `textContent` getter. Removing
        // `init()` does NOT fail this test — jsdom does not mock that getter —
        // so the `init()` call in `extcss-inject-src.ts` is pinned by the
        // builder test "calls init() before apply()" instead.
        document.body.innerHTML = '<div class="ad">adsbygoogle</div>';

        createSerializedApply()(['.ad:contains(adsbygoogle) { display: none !important; }'], false, EXTCSS_PROTOCOL);

        const ad = document.querySelector('.ad') as HTMLElement;
        expect(ad.style.getPropertyValue('display')).toBe('none');
        expect(ad.style.getPropertyPriority('display')).toBe('important');
    });

    it('does not hide non-matching elements', () => {
        document.body.innerHTML = '<div class="ad"><span class="other">ad</span></div>';

        createSerializedApply()(['.ad:has(.child) { display: none !important; }'], false, EXTCSS_PROTOCOL);

        const ad = document.querySelector('.ad') as HTMLElement;
        expect(ad.style.getPropertyValue('display')).toBe('');
    });

    it('hides a matching :matches-css() element (exercises escapeRegExp)', () => {
        // `:matches-css()` builds a regex from the declared value via
        // `escapeRegExp`, which contains `$&`. jsdom normalizes `color: red`
        // to `rgb(255, 0, 0)` (parentheses are regex metacharacters that
        // `escapeRegExp` must escape), so this rule only hides the element when
        // the bundled engine is intact. A corrupted script asset build turns
        // the escaped value into garbage and the regex no longer matches.
        document.body.innerHTML = '<div class="ad" style="color: red">ad</div>';

        createSerializedApply()(
            ['.ad:matches-css(color: rgb(255, 0, 0)) { display: none !important; }'],
            false,
            EXTCSS_PROTOCOL,
        );

        const ad = document.querySelector('.ad') as HTMLElement;
        expect(ad.style.getPropertyValue('display')).toBe('none');
        expect(ad.style.getPropertyPriority('display')).toBe('important');
    });
});

describe('extCssInjectedApply — re-apply in the same document', () => {
    it('disposes the previous instance on re-apply (old styles reverted, old observer stopped)', async () => {
        // First injection: rule A hides `.ad:has(.child)`.
        document.body.innerHTML = '<div class="ad"><span class="child">ad</span></div>';
        createSerializedApply()(['.ad:has(.child) { display: none !important; }'], false, EXTCSS_PROTOCOL);
        const ad = document.querySelector('.ad') as HTMLElement;
        expect(ad.style.getPropertyValue('display')).toBe('none');

        // Second injection into the SAME document, with a different rule set.
        // A navigation is not modelled here: it creates a new document and a
        // new isolated world, so it cannot hit this path. The previous
        // instance must be disposed: its styles are reverted synchronously by
        // dispose().
        createSerializedApply()(['.other:has(.x) { display: none !important; }'], false, EXTCSS_PROTOCOL);

        // Old instance's styles reverted → `.ad` is visible again.
        expect(ad.style.getPropertyValue('display')).toBe('');

        // New instance active: a dynamically added `.other:has(.x)` node is
        // hidden by the new instance's MutationObserver.
        const other = document.createElement('div');
        other.className = 'other';
        other.innerHTML = '<span class="x"></span>';
        document.body.appendChild(other);

        await vi.waitFor(() => {
            expect((other as HTMLElement).style.getPropertyValue('display')).toBe('none');
        }, { timeout: 1000, interval: 30 });

        // Old instance's observer is disconnected: a newly added `.ad:has(.child)`
        // node is NOT hidden (the new instance only handles `.other:has(.x)`).
        const ad2 = document.createElement('div');
        ad2.className = 'ad';
        ad2.innerHTML = '<span class="child">ad</span>';
        document.body.appendChild(ad2);

        // Give the (disposed) old observer and the new observer a chance to run.
        await new Promise((resolve) => { setTimeout(resolve, 250); });
        expect((ad2 as HTMLElement).style.getPropertyValue('display')).toBe('');
    });

    it('keeps the retained instance when the rule set is unchanged', () => {
        document.body.innerHTML = '<div class="ad"><span class="child">ad</span></div>';
        const rules = ['.ad:has(.child) { display: none !important; }'];

        extCssInjectedApply(rules, false, EXTCSS_PROTOCOL);

        const ad = document.querySelector('.ad') as HTMLElement;
        expect(ad.style.getPropertyValue('display')).toBe('none');

        // An inline style the rule does not touch, applied after the injection.
        ad.style.setProperty('color', 'red');

        const w = window as unknown as Record<string, unknown>;
        const retainedBefore = w[EXTCSS_PROTOCOL.instanceKey];

        // The background records an applied rule set and skips it, but a
        // frame with no context has no state to record, and the content script
        // can ask for its data again, so the payload still guards itself.
        // dispose() would revert the element to its pre-extCSS `cssText`
        // snapshot, so a real re-apply would drop `color` and re-run the whole
        // engine.
        extCssInjectedApply(rules, false, EXTCSS_PROTOCOL);

        expect(w[EXTCSS_PROTOCOL.instanceKey]).toBe(retainedBefore);
        expect(ad.style.getPropertyValue('color')).toBe('red');
        expect(ad.style.getPropertyValue('display')).toBe('none');
    });

    it('hands `:remove()` nodes over to the content script', () => {
        document.body.innerHTML = '<div class="ad">ad</div>';

        const ad = document.querySelector('.ad') as HTMLElement;

        // Statistics on: the callback is only registered for the counter, and
        // the counter is only created when the stats are collected.
        extCssInjectedApply(['.ad:remove()'], true, EXTCSS_PROTOCOL);

        // The engine removes the node itself, so the counter must not put it
        // back as a probe. It reads the node from this shared set, because the
        // payload runs outside the counter.
        expect(ad.parentNode).toBeNull();

        const w = window as unknown as Record<string, WeakSet<Element> | undefined>;
        const removedElements = w[EXTCSS_PROTOCOL.removedElementsKey];

        expect(removedElements).toBeInstanceOf(WeakSet);
        expect(removedElements?.has(ad)).toBe(true);
    });
});

/**
 * Stubs `window.MutationObserver` so that its first construction throws.
 *
 * The engine creates its style-protection and document observers after the
 * rules were applied, so a throwing constructor fails the apply synchronously
 * — after the styles were set, but before the instance is returned. Only the
 * FIRST construction throws, so a restore apply still succeeds.
 */
function stubOneShotThrowingMutationObserver(): void {
    const RealMutationObserver = window.MutationObserver;
    let observerConstructions = 0;

    /**
     * MutationObserver stub that throws on its first construction only.
     */
    class OneShotThrowingMutationObserver extends RealMutationObserver {
        /**
         * Throws on the first construction, then delegates to the real
         * observer so the restore path can succeed.
         *
         * @param callback Mutation callback.
         */
        constructor(callback: MutationCallback) {
            observerConstructions += 1;
            if (observerConstructions === 1) {
                throw new Error('simulated apply failure');
            }
            super(callback);
        }
    }

    vi.stubGlobal('MutationObserver', OneShotThrowingMutationObserver);
}

/**
 * Reinstalls the ExtendedCss engine with `window.MutationObserver` stubbed for
 * its first construction.
 *
 * The engine reads the native observer when its module is evaluated, and the
 * prebuilt script asset is such a module. A document that loads the asset after
 * the stub — which is what this helper models — therefore gets an engine whose
 * first observer construction throws.
 */
const installEngineWithOneShotThrowingObserver = async (): Promise<void> => {
    stubOneShotThrowingMutationObserver();

    try {
        vi.resetModules();
        await import('../../../src/lib/common/extcss-engine');
    } finally {
        vi.unstubAllGlobals();
    }
};

describe('extCssInjectedApply — atomic re-apply', () => {
    it('restores the previous filtering when the new apply throws', async () => {
        document.body.innerHTML = '<div class="ad"><span class="child">ad</span></div>';

        createSerializedApply()(['.ad:has(.child) { display: none !important; }'], false, EXTCSS_PROTOCOL);

        const ad = document.querySelector('.ad') as HTMLElement;
        expect(ad.style.getPropertyValue('display')).toBe('none');

        const w = window as unknown as Record<string, unknown>;
        // eslint-disable-next-line no-underscore-dangle -- deliberate marker matching the retained-instance key
        expect(w.__adguardExtCss).toBeTruthy();

        // Force the next apply to throw deterministically.
        await installEngineWithOneShotThrowingObserver();

        expect(() => createSerializedApply()(
            ['.never-matches { display: none !important; }'],
            false,
            EXTCSS_PROTOCOL,
        )).toThrow('simulated apply failure');

        // The failed apply must NOT leave the page unprotected: the previous
        // rule strings are re-applied on a fresh instance.
        // eslint-disable-next-line no-underscore-dangle -- deliberate marker matching the retained-instance key
        expect(w.__adguardExtCss).toBeTruthy();
        expect(ad.style.getPropertyValue('display')).toBe('none');
        expect(ad.style.getPropertyPriority('display')).toBe('important');
    });

    it('reverts the failed apply\'s styles before restoring the previous rule set', async () => {
        document.body.innerHTML = '<div class="ad">ad</div>';

        createSerializedApply()(['.ad { display: none !important; }'], false, EXTCSS_PROTOCOL);

        const ad = document.querySelector('.ad') as HTMLElement;
        expect(ad.style.getPropertyValue('display')).toBe('none');

        // The failing apply matches `.ad` and sets `visibility: hidden` before
        // the observer construction throws.
        await installEngineWithOneShotThrowingObserver();

        expect(() => createSerializedApply()(
            ['.ad { visibility: hidden !important; }'],
            false,
            EXTCSS_PROTOCOL,
        )).toThrow('simulated apply failure');

        // The failed instance is disposed by the inject source, so its style is
        // reverted instead of becoming the restored instance's `originalStyle`
        // snapshot.
        expect(ad.style.getPropertyValue('visibility')).toBe('');
        expect(ad.style.getPropertyValue('display')).toBe('none');
        expect(ad.style.getPropertyPriority('display')).toBe('important');
    });

    it('snapshots clean original styles across a re-apply (no stale styles after disposal)', () => {
        document.body.innerHTML = '<div class="ad">ad</div>';

        // First injection: `.ad` is hidden.
        createSerializedApply()(['.ad { display: none !important; }'], false, EXTCSS_PROTOCOL);

        const ad = document.querySelector('.ad') as HTMLElement;
        expect(ad.style.getPropertyValue('display')).toBe('none');

        // Second injection matches the same element with a different property.
        createSerializedApply()(['.ad { visibility: hidden !important; }'], false, EXTCSS_PROTOCOL);

        // The previous instance is disposed BEFORE the new one applies, so the
        // new instance snapshots the element's clean `cssText`: the old style
        // is gone and only the new style is set.
        expect(ad.style.getPropertyValue('display')).toBe('');
        expect(ad.style.getPropertyValue('visibility')).toBe('hidden');

        // Disposing the new instance must not resurrect the old style.
        // eslint-disable-next-line no-underscore-dangle -- deliberate marker matching the retained-instance key
        const retained = (window as unknown as { __adguardExtCss?: { dispose(): void } | null }).__adguardExtCss;
        retained?.dispose();

        expect(ad.style.getPropertyValue('display')).toBe('');
        expect(ad.style.getPropertyValue('visibility')).toBe('');
    });
});

describe('extCssInjectedApply — continuous observation', () => {
    it('hides a matching element added dynamically after extCssInjectedApply', async () => {
        document.body.innerHTML = '';
        createSerializedApply()(['.ad:has(.child) { display: none !important; }'], false, EXTCSS_PROTOCOL);

        // Append a matching element after the call.
        const ad = document.createElement('div');
        ad.className = 'ad';
        ad.innerHTML = '<span class="child">ad</span>';
        document.body.appendChild(ad);

        // The MutationObserver (throttled via setTimeout) re-applies the rules.
        await vi.waitFor(() => {
            expect((ad as HTMLElement).style.getPropertyValue('display')).toBe('none');
            expect((ad as HTMLElement).style.getPropertyPriority('display')).toBe('important');
        }, { timeout: 1000, interval: 30 });
    });
});

describe('extCssInjectedApply — CSS hits stats', () => {
    // Rule built with a hits marker: the content value encodes
    // adguard{filterId}%3B{ruleIndex} (the %3B is the URI-encoded ';'
    // separator produced by buildStyleSheetsWithHits).
    const MARKER_RULE = '.ad:has(.child) { display: none !important; content: \'adguard1%3B2\' !important; }';

    let sendMessageSpy: ReturnType<typeof vi.spyOn>;

    beforeEach(() => {
        // chrome.runtime.sendMessage is a sinon-chrome stub, not a vitest spy,
        // so wrap it to make vitest matchers/mock.calls available.
        sendMessageSpy = vi.spyOn(chrome.runtime, 'sendMessage');
    });

    afterEach(() => {
        sendMessageSpy.mockRestore();
    });

    it('sends a SaveCssHitsStats message when collectStats is on and a rule carries a marker', async () => {
        document.body.innerHTML = '<div class="ad"><span class="child">ad</span></div>';

        createSerializedApply()([MARKER_RULE], true, EXTCSS_PROTOCOL);

        // Flush microtasks so the deferred sendMessage (via Promise.resolve().then(...))
        // is recorded by the spy.
        await new Promise((resolve) => { setTimeout(resolve, 0); });

        expect(sendMessageSpy).toHaveBeenCalledTimes(1);
        const msg = sendMessageSpy.mock.calls[0][0];
        expect(msg).toEqual({
            handlerName: 'tsWebExtension',
            type: 'saveCssHitsStats',
            payload: [{ filterId: 1, ruleIndex: 2, element: expect.any(String) }],
        });
        // Assert the FULL serialized form to guard against the malformed-tag
        // regression (must be `<div class="ad">`, not `<div> class="ad">`).
        expect((msg as any).payload[0].element).toBe('<div class="ad">');
    });

    it('reports one hit per element matched by the same rule', async () => {
        // ExtendedCss keeps one parsed rule object shared by every element the
        // rule matches. Consuming the marker on that object would report only
        // the first element and leave the others uncounted.
        document.body.innerHTML = '<div id="first" class="ad"><span class="child">ad</span></div>'
            + '<div id="second" class="ad"><span class="child">ad</span></div>';

        createSerializedApply()([MARKER_RULE], true, EXTCSS_PROTOCOL);

        await new Promise((resolve) => { setTimeout(resolve, 0); });

        // Both hits of one apply batch travel in a single message.
        expect(sendMessageSpy).toHaveBeenCalledTimes(1);
        const elements = (sendMessageSpy.mock.calls[0][0] as any).payload
            .map((hit: any) => hit.element);
        expect(elements).toEqual(['<div id="first" class="ad">', '<div id="second" class="ad">']);
    });

    it('records the nodes removed by a :remove() rule for the content-script counter', () => {
        // In MV3 the content script no longer runs ExtendedCss, so its
        // `beforeStyleApplied` callback never sees the `:remove()` rules. The
        // removed nodes are kept on `window` — the injected function shares
        // the document's ISOLATED world with the content script — so the
        // CssHitsCounter does not put them back into the page as probes.
        document.body.innerHTML = '<div class="ad">ad</div>';
        const ad = document.querySelector('.ad') as HTMLElement;

        createSerializedApply()(['.ad:remove()'], true, EXTCSS_PROTOCOL);

        const removed = (window as unknown as Record<string, WeakSet<Element>>)[EXTCSS_PROTOCOL.removedElementsKey];

        expect(removed).toBeInstanceOf(WeakSet);
        expect(removed.has(ad)).toBe(true);
        expect(ad.parentNode).toBeNull();
    });

    it('reports a hit for an element matched after the apply', async () => {
        document.body.innerHTML = '<div id="first" class="ad"><span class="child">ad</span></div>';

        createSerializedApply()([MARKER_RULE], true, EXTCSS_PROTOCOL);

        await new Promise((resolve) => { setTimeout(resolve, 0); });
        expect(sendMessageSpy).toHaveBeenCalledTimes(1);

        // A node added later is matched by the same parsed rule, so it must
        // still carry the marker and be reported.
        const added = document.createElement('div');
        added.id = 'added';
        added.className = 'ad';
        added.innerHTML = '<span class="child">ad</span>';
        document.body.appendChild(added);

        await vi.waitFor(() => {
            expect(sendMessageSpy).toHaveBeenCalledTimes(2);
        }, { timeout: 1000, interval: 30 });

        const msg = sendMessageSpy.mock.calls[1][0] as any;
        expect(msg.payload[0].element).toBe('<div id="added" class="ad">');
    });

    it('swallows a rejected sendMessage so no unhandled rejection escapes beforeStyleApplied', async () => {
        document.body.innerHTML = '<div class="ad"><span class="child">ad</span></div>';

        // Simulate "Receiving end does not exist." while the SW is asleep. A
        // synchronous try/catch could not catch this async rejection — the
        // fire-and-forget reporter must attach .catch().
        sendMessageSpy.mockImplementation((): Promise<never> => Promise.reject(
            new Error('Receiving end does not exist.'),
        ));

        const unhandled: unknown[] = [];
        const onUnhandled = (reason: unknown): void => { unhandled.push(reason); };
        process.on('unhandledRejection', onUnhandled);

        try {
            // Must not throw synchronously; an uncaught throw would fail here.
            createSerializedApply()([MARKER_RULE], true, EXTCSS_PROTOCOL);

            // Flush microtasks so the rejected sendMessage promise settles and
            // the .catch() handler runs.
            await new Promise((resolve) => { setTimeout(resolve, 50); });
        } finally {
            process.off('unhandledRejection', onUnhandled);
        }

        expect(sendMessageSpy).toHaveBeenCalledTimes(1);
        expect(unhandled).toHaveLength(0);
    });

    it('registers no beforeStyleApplied and sends no message when collectStats is off', () => {
        document.body.innerHTML = '<div class="ad"><span class="child">ad</span></div>';

        createSerializedApply()(['.ad:has(.child) { display: none !important; }'], false, EXTCSS_PROTOCOL);

        expect(sendMessageSpy).not.toHaveBeenCalled();
    });

    it('uses the passed-in protocol values, not the shared defaults', async () => {
        document.body.innerHTML = '<div class="ad"><span class="child">ad</span></div>';

        // A non-default protocol: the injected function must use THESE values
        // (proving nothing is read from module scope or duplicated literals).
        // The type narrows these fields to the shared literals, so the object is
        // cast: this test checks the RUNTIME contract of the argument.
        const customProtocol = {
            markerPrefix: 'custommarker',
            handlerName: 'customHandler',
            messageType: 'customCssHitsType',
            // eslint-disable-next-line no-underscore-dangle -- deliberate test marker key
            instanceKey: '__customExtCss',
            // eslint-disable-next-line no-underscore-dangle -- deliberate test marker key
            removedElementsKey: '__customExtCssRemoved',
            // The engine asset is installed under the shared key and version:
            // the custom protocol must keep pointing at it, otherwise nothing
            // can apply.
            engineKey: EXTCSS_PROTOCOL.engineKey,
            engineVersion: EXTCSS_PROTOCOL.engineVersion,
            applyErrors: EXTCSS_PROTOCOL.applyErrors,
        } as unknown as ExtCssProtocol;
        const customMarkerRule = '.ad:has(.child) { display: none !important; '
            + 'content: \'custommarker1%3B2\' !important; }';

        try {
            createSerializedApply()([customMarkerRule], true, customProtocol);

            // Flush microtasks so the deferred sendMessage is recorded by the spy.
            await new Promise((resolve) => { setTimeout(resolve, 0); });

            expect(sendMessageSpy).toHaveBeenCalledTimes(1);
            const msg = sendMessageSpy.mock.calls[0][0];
            expect(msg).toEqual({
                handlerName: 'customHandler',
                type: 'customCssHitsType',
                payload: [{ filterId: 1, ruleIndex: 2, element: expect.any(String) }],
            });

            // The instance is retained under the CUSTOM key, never the default.
            const w = window as unknown as Record<string, unknown>;
            // eslint-disable-next-line no-underscore-dangle -- deliberate test marker key
            expect(w.__customExtCss).toBeTruthy();
            // eslint-disable-next-line no-underscore-dangle -- deliberate test marker key
            expect(w.__adguardExtCss).toBeFalsy();
        } finally {
            // Clean up the custom retained instance.
            const w = window as unknown as Record<string, { dispose(): void } | null>;
            // eslint-disable-next-line no-underscore-dangle -- deliberate test marker key
            const handle = w.__customExtCss;
            if (handle) {
                try {
                    handle.dispose();
                } catch {
                    // ignore
                }
            }
            // eslint-disable-next-line no-underscore-dangle -- deliberate test marker key
            w.__customExtCss = null;
        }
    });

    // Regression: the per-node dedup guard must prevent duplicate hits when
    // the same element is re-styled by the throttled MutationObserver. The
    // applied copy of the rule loses the marker, and the node/rule pair is
    // tracked, so a second beforeStyleApplied call reports nothing.
    it('does not send duplicate hits for the same element and rule', async () => {
        document.body.innerHTML = '<div class="ad"><span class="child">ad</span></div>';

        createSerializedApply()([MARKER_RULE], true, EXTCSS_PROTOCOL);

        // Flush microtasks so the deferred sendMessage is recorded by the spy.
        await new Promise((resolve) => { setTimeout(resolve, 0); });

        expect(sendMessageSpy).toHaveBeenCalledTimes(1);

        // Wait for the throttled MutationObserver to run.
        // If the dedup guard fails (content not cleared), the observer
        // would re-send the hit on its next pass.
        await new Promise((resolve) => { setTimeout(resolve, 300); });
        expect(sendMessageSpy).toHaveBeenCalledTimes(1);
    });

    it('does not report the hits again when the same document is re-injected', async () => {
        document.body.innerHTML = '<div class="ad"><span class="child">ad</span></div>';

        createSerializedApply()([MARKER_RULE], true, EXTCSS_PROTOCOL);

        await new Promise((resolve) => { setTimeout(resolve, 0); });
        expect(sendMessageSpy).toHaveBeenCalledTimes(1);

        // A second injection into the same document — e.g. `onCommitted`
        // firing while `processOpenTabs` is still running — receives the same
        // marker-carrying rule strings, so it is a no-op. The retained
        // per-node dedupe state keeps the hit above from being reported again.
        createSerializedApply()([MARKER_RULE], true, EXTCSS_PROTOCOL);

        await new Promise((resolve) => { setTimeout(resolve, 0); });
        expect(sendMessageSpy).toHaveBeenCalledTimes(1);
    });

    it('reports hits for elements matched after a re-injection', async () => {
        document.body.innerHTML = '<div id="first" class="ad"><span class="child">ad</span></div>';

        createSerializedApply()([MARKER_RULE], true, EXTCSS_PROTOCOL);

        await new Promise((resolve) => { setTimeout(resolve, 0); });
        expect(sendMessageSpy).toHaveBeenCalledTimes(1);

        // A re-injection with the same rule strings is a no-op, so the
        // retained instance and its callback stay in place: elements matched
        // for the first time are still reported by that observer.
        createSerializedApply()([MARKER_RULE], true, EXTCSS_PROTOCOL);

        await new Promise((resolve) => { setTimeout(resolve, 0); });
        expect(sendMessageSpy).toHaveBeenCalledTimes(1);

        const added = document.createElement('div');
        added.id = 'added';
        added.className = 'ad';
        added.innerHTML = '<span class="child">ad</span>';
        document.body.appendChild(added);

        await vi.waitFor(() => {
            expect(sendMessageSpy).toHaveBeenCalledTimes(2);
        }, { timeout: 1000, interval: 30 });

        // Only the new node is reported; the already counted one is skipped.
        const msg = sendMessageSpy.mock.calls[1][0] as any;
        expect(msg.payload[0].element).toBe('<div id="added" class="ad">');
    });

    // Regression: attribute values containing double-quotes must be escaped
    // (\" -> backslash-quote) in the element serialization, matching MV2's
    // ElementUtils.elementToString.
    it('correctly escapes double-quotes in attribute values when serializing element', async () => {
        // Single-quoted HTML attribute value containing a literal "
        document.body.innerHTML = '<div data-x=\'a"b\' class="ad"><span class="child">ad</span></div>';

        createSerializedApply()([MARKER_RULE], true, EXTCSS_PROTOCOL);

        // Flush microtasks so the deferred sendMessage is recorded by the spy.
        await new Promise((resolve) => { setTimeout(resolve, 0); });

        expect(sendMessageSpy).toHaveBeenCalledTimes(1);
        const msg = sendMessageSpy.mock.calls[0][0] as any;
        // The serialized element must escape the " in the data-x value.
        expect(msg.payload[0].element).toBe('<div data-x="a\\"b" class="ad">');
    });
});

describe('extCssInjectedApply — prebuilt engine asset', () => {
    it('reads the engine installed by the script asset protocol key', () => {
        const engine = window[EXTCSS_PROTOCOL.engineKey];
        expect(engine).toBeDefined();

        document.body.innerHTML = '<div class="ad"><span class="child">ad</span></div>';

        createSerializedApply()(['.ad:has(.child) { display: none !important; }'], false, EXTCSS_PROTOCOL);

        const ad = document.querySelector('.ad') as HTMLElement;
        expect(ad.style.getPropertyValue('display')).toBe('none');
    });

    it('reports a failure instead of applying when the engine asset was not injected', () => {
        document.body.innerHTML = '<div class="ad"><span class="child">ad</span></div>';
        const engine = window[EXTCSS_PROTOCOL.engineKey];
        delete window[EXTCSS_PROTOCOL.engineKey];

        try {
            const result = createSerializedApply()(
                ['.ad:has(.child) { display: none !important; }'],
                false,
                EXTCSS_PROTOCOL,
            );

            expect(result).toEqual({
                error: EXTCSS_PROTOCOL.applyErrors.engineNotLoaded,
                message: expect.stringContaining('ExtendedCss engine is not loaded'),
            });

            const ad = document.querySelector('.ad') as HTMLElement;
            expect(ad.style.getPropertyValue('display')).toBe('');
        } finally {
            window[EXTCSS_PROTOCOL.engineKey] = engine;
        }
    });

    it('reports a failure instead of applying when the engine asset has another version', () => {
        document.body.innerHTML = '<div class="ad"><span class="child">ad</span></div>';
        const engine = window[EXTCSS_PROTOCOL.engineKey];

        if (!engine) {
            throw new Error('The test setup must install the engine asset');
        }

        // A stale copy of the asset, e.g. one shipped by an older package.
        window[EXTCSS_PROTOCOL.engineKey] = { ...engine, version: '0.0.0-other' };

        try {
            const result = createSerializedApply()(
                ['.ad:has(.child) { display: none !important; }'],
                false,
                EXTCSS_PROTOCOL,
            );

            expect(result).toEqual({
                error: EXTCSS_PROTOCOL.applyErrors.engineVersionMismatch,
                message: expect.stringContaining('ExtendedCss engine version mismatch'),
            });

            const ad = document.querySelector('.ad') as HTMLElement;
            expect(ad.style.getPropertyValue('display')).toBe('');
        } finally {
            window[EXTCSS_PROTOCOL.engineKey] = engine;
        }
    });
});

describe('extCssInjectedDispose', () => {
    it('disposes the retained instance and reverts its styles', () => {
        document.body.innerHTML = '<div class="ad">ad</div>';
        createSerializedApply()(['.ad { display: none !important; }'], false, EXTCSS_PROTOCOL);

        const ad = document.querySelector('.ad') as HTMLElement;
        expect(ad.style.getPropertyValue('display')).toBe('none');

        extCssInjectedDispose(EXTCSS_PROTOCOL);

        expect(ad.style.getPropertyValue('display')).toBe('');
    });

    it('clears the retained instance so a second call is a no-op', () => {
        createSerializedApply()(['.ad { display: none !important; }'], false, EXTCSS_PROTOCOL);

        const w = window as unknown as Record<string, unknown>;
        expect(w[EXTCSS_PROTOCOL.instanceKey]).toBeTruthy();

        extCssInjectedDispose(EXTCSS_PROTOCOL);

        expect(w[EXTCSS_PROTOCOL.instanceKey]).toBeNull();
        expect(() => extCssInjectedDispose(EXTCSS_PROTOCOL)).not.toThrow();
    });

    it('clears the key even when the retained dispose throws', () => {
        const dispose = vi.fn(() => {
            throw new Error('dispose failed');
        });
        const w = window as unknown as Record<string, unknown>;
        w[EXTCSS_PROTOCOL.instanceKey] = { dispose };

        expect(() => extCssInjectedDispose(EXTCSS_PROTOCOL)).not.toThrow();

        expect(dispose).toHaveBeenCalledTimes(1);
        expect(w[EXTCSS_PROTOCOL.instanceKey]).toBeNull();
    });
});
