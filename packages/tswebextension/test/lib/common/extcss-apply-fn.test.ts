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

import { extCssInjectedApply } from '../../../src/lib/common/extcss-apply-fn';
import { EXTCSS_PROTOCOL, type ExtCssProtocol } from '../../../src/lib/common/message-constants';

import { resetExtCssState } from './helpers';

// Single file-level cleanup. The jsdom `window` is shared across every test in
// this file, so a retained ExtendedCss instance (and its MutationObserver)
// would leak into the next test.
afterEach(() => {
    resetExtCssState();
});

describe('extCssInjectedApply (inlined bundle)', () => {
    it('hides a matching :has() element after being called', () => {
        document.body.innerHTML = '<div class="ad"><span class="child">ad</span></div>';

        extCssInjectedApply(['.ad:has(.child) { display: none !important; }'], false, EXTCSS_PROTOCOL);

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

        extCssInjectedApply(['.ad:contains(adsbygoogle) { display: none !important; }'], false, EXTCSS_PROTOCOL);

        const ad = document.querySelector('.ad') as HTMLElement;
        expect(ad.style.getPropertyValue('display')).toBe('none');
        expect(ad.style.getPropertyPriority('display')).toBe('important');
    });

    it('does not hide non-matching elements', () => {
        document.body.innerHTML = '<div class="ad"><span class="other">ad</span></div>';

        extCssInjectedApply(['.ad:has(.child) { display: none !important; }'], false, EXTCSS_PROTOCOL);

        const ad = document.querySelector('.ad') as HTMLElement;
        expect(ad.style.getPropertyValue('display')).toBe('');
    });

    it('is a self-contained function (toString contains the inlined engine)', () => {
        // The inlined IIFE assigns `applyExtendedCss`; ensure the engine code
        // is embedded in the function source so it survives executeScript
        // serialization (closure variables would not).
        expect(String(extCssInjectedApply)).toContain('applyExtendedCss');
    });

    it('is self-contained — the instance key arrives via the protocol argument', () => {
        // extCssInjectedApply is serialized via Function.toString() and re-executed in the
        // page's ISOLATED world by executeScript({ func }). Any module-scope
        // identifier referenced in the body becomes a free identifier there
        // (ReferenceError, or `undefined`), so the retain/dispose key MUST
        // arrive via the serialized `protocol` argument — not as a body
        // literal duplicated across call sites, and not as a module-scope ref.
        const src = String(extCssInjectedApply);
        expect(src).toContain('protocol.instanceKey');
        expect(src).not.toContain('__adguardExtCss');
        expect(src).not.toContain('EXTCSS_INSTANCE_KEY');
        expect(src).not.toContain('EXTCSS_PROTOCOL');
    });

    // Regression: the build-time inliner must not let `String.prototype.replace`
    // interpret `$` patterns in the bundle source. The bundle contains `$&`
    // inside its `escapeRegExp` utilities; with a string replacement that would
    // be substituted with the matched marker text, corrupting the inlined
    // engine and breaking regex-dependent pseudo-classes.
    it('preserves raw `$&` in the inlined engine source', () => {
        expect(String(extCssInjectedApply)).toContain('$&');
        // The marker call must not survive inlining.
        expect(String(extCssInjectedApply)).not.toContain('__INLINE_EXTCSS_BUNDLE__');
    });

    it('hides a matching :matches-css() element (exercises escapeRegExp)', () => {
        // `:matches-css()` builds a regex from the declared value via
        // `escapeRegExp`, which contains `$&`. jsdom normalizes `color: red`
        // to `rgb(255, 0, 0)` (parentheses are regex metacharacters that
        // `escapeRegExp` must escape), so this rule only hides the element when
        // the inlined engine is intact. With the corrupted inliner the
        // escaped value becomes garbage and the regex no longer matches.
        document.body.innerHTML = '<div class="ad" style="color: red">ad</div>';

        extCssInjectedApply(
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
        extCssInjectedApply(['.ad:has(.child) { display: none !important; }'], false, EXTCSS_PROTOCOL);
        const ad = document.querySelector('.ad') as HTMLElement;
        expect(ad.style.getPropertyValue('display')).toBe('none');

        // Second injection into the SAME document, with a different rule set.
        // A navigation is not modelled here: it creates a new document and a
        // new isolated world, so it cannot hit this path. The previous
        // instance must be disposed: its styles are reverted synchronously by
        // dispose().
        extCssInjectedApply(['.other:has(.x) { display: none !important; }'], false, EXTCSS_PROTOCOL);

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

describe('extCssInjectedApply — atomic re-apply', () => {
    it('restores the previous filtering when the new apply throws', () => {
        document.body.innerHTML = '<div class="ad"><span class="child">ad</span></div>';

        extCssInjectedApply(['.ad:has(.child) { display: none !important; }'], false, EXTCSS_PROTOCOL);

        const ad = document.querySelector('.ad') as HTMLElement;
        expect(ad.style.getPropertyValue('display')).toBe('none');

        const w = window as unknown as Record<string, unknown>;
        // eslint-disable-next-line no-underscore-dangle -- deliberate marker matching the retained-instance key
        expect(w.__adguardExtCss).toBeTruthy();

        // Force the next apply to throw deterministically.
        stubOneShotThrowingMutationObserver();

        try {
            expect(() => extCssInjectedApply(
                ['.never-matches { display: none !important; }'],
                false,
                EXTCSS_PROTOCOL,
            )).toThrow('simulated apply failure');
        } finally {
            vi.unstubAllGlobals();
        }

        // The failed apply must NOT leave the page unprotected: the previous
        // rule strings are re-applied on a fresh instance.
        // eslint-disable-next-line no-underscore-dangle -- deliberate marker matching the retained-instance key
        expect(w.__adguardExtCss).toBeTruthy();
        expect(ad.style.getPropertyValue('display')).toBe('none');
        expect(ad.style.getPropertyPriority('display')).toBe('important');
    });

    it('reverts the failed apply\'s styles before restoring the previous rule set', () => {
        document.body.innerHTML = '<div class="ad">ad</div>';

        extCssInjectedApply(['.ad { display: none !important; }'], false, EXTCSS_PROTOCOL);

        const ad = document.querySelector('.ad') as HTMLElement;
        expect(ad.style.getPropertyValue('display')).toBe('none');

        // The failing apply matches `.ad` and sets `visibility: hidden` before
        // the observer construction throws.
        stubOneShotThrowingMutationObserver();

        try {
            expect(() => extCssInjectedApply(
                ['.ad { visibility: hidden !important; }'],
                false,
                EXTCSS_PROTOCOL,
            )).toThrow('simulated apply failure');
        } finally {
            vi.unstubAllGlobals();
        }

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
        extCssInjectedApply(['.ad { display: none !important; }'], false, EXTCSS_PROTOCOL);

        const ad = document.querySelector('.ad') as HTMLElement;
        expect(ad.style.getPropertyValue('display')).toBe('none');

        // Second injection matches the same element with a different property.
        extCssInjectedApply(['.ad { visibility: hidden !important; }'], false, EXTCSS_PROTOCOL);

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
        extCssInjectedApply(['.ad:has(.child) { display: none !important; }'], false, EXTCSS_PROTOCOL);

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

        extCssInjectedApply([MARKER_RULE], true, EXTCSS_PROTOCOL);

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

        extCssInjectedApply([MARKER_RULE], true, EXTCSS_PROTOCOL);

        await new Promise((resolve) => { setTimeout(resolve, 0); });

        expect(sendMessageSpy).toHaveBeenCalledTimes(2);
        const elements = sendMessageSpy.mock.calls.map(
            (call: any[]) => (call[0] as any).payload[0].element,
        );
        expect(elements).toEqual(['<div id="first" class="ad">', '<div id="second" class="ad">']);
    });

    it('reports a hit for an element matched after the apply', async () => {
        document.body.innerHTML = '<div id="first" class="ad"><span class="child">ad</span></div>';

        extCssInjectedApply([MARKER_RULE], true, EXTCSS_PROTOCOL);

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

    it('uses .catch() — not try/catch — to swallow the async sendMessage rejection', () => {
        const src = String(extCssInjectedApply);
        // The fire-and-forget reporter MUST attach .catch(); a synchronous
        // try/catch cannot catch the async rejection from sendMessage in MV3.
        expect(src).toContain('Promise.resolve(');
        expect(src).toMatch(/\.catch\s*\(/);
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
            extCssInjectedApply([MARKER_RULE], true, EXTCSS_PROTOCOL);

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

        extCssInjectedApply(['.ad:has(.child) { display: none !important; }'], false, EXTCSS_PROTOCOL);

        expect(sendMessageSpy).not.toHaveBeenCalled();
    });

    it('is self-contained — protocol literals arrive via the protocol argument', () => {
        const src = String(extCssInjectedApply);
        // The hit-bridge protocol values (marker prefix, handler name, message
        // type) MUST arrive via the serialized `protocol` argument — the
        // shared `EXTCSS_PROTOCOL` constant is the single source of truth, so
        // the literals must NOT be duplicated in the injected function body.
        expect(src).not.toMatch(/['"]adguard['"]/);
        expect(src).not.toMatch(/['"]tsWebExtension['"]/);
        expect(src).not.toMatch(/['"]saveCssHitsStats['"]/);
        // The body reads them from the `protocol` parameter.
        expect(src).toContain('protocol.markerPrefix');
        expect(src).toContain('protocol.handlerName');
        expect(src).toContain('protocol.messageType');
        // No module-scope identifier leaks for these concepts.
        expect(src).not.toMatch(/\bEXTCSS_PROTOCOL\b/);
        expect(src).not.toMatch(/\bMESSAGE_HANDLER_NAME\b/);
        expect(src).not.toMatch(/\bMessageType\b/);
        expect(src).not.toMatch(/\bCSS_HITS_MARKER_PREFIX\b/);
        expect(src).not.toMatch(/\bHANDLER_NAME\b/);
        expect(src).not.toMatch(/\bCONTENT_ATTR_PREFIX\b/);
        expect(src).not.toMatch(/\bSAVE_CSS_HITS_STATS\b/);
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
        } as unknown as ExtCssProtocol;
        const customMarkerRule = '.ad:has(.child) { display: none !important; '
            + 'content: \'custommarker1%3B2\' !important; }';

        try {
            extCssInjectedApply([customMarkerRule], true, customProtocol);

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

    it('inlines the CSS-hits helpers (shared with MV2 ElementUtils) with no external refs', () => {
        const src = String(extCssInjectedApply);

        // The inlined helpers must define cssHitsHelpers locally so the
        // beforeStyleApplied callback can call parseExtendedStyleInfo() and
        // elementToString() without unresolved free identifiers.
        expect(src).toContain('cssHitsHelpers');
        expect(src).toContain('parseExtendedStyleInfo');
        expect(src).toContain('elementToString');

        // The build-time marker CALL must not survive inlining.
        // (Comments mentioning the marker name are OK — only an unresolved
        // call would be a free identifier.)
        expect(src).not.toMatch(/__INLINE_CSS_HITS_HELPERS__\s*\(\s*\)\s*;/);

        // No code-level reference to the MV2 ElementUtils class — the helper
        // functions must be accessed via the inlined `cssHitsHelpers`, not
        // through an imported `ElementUtils.` class. (JSDoc comments that
        // merely *mention* ElementUtils descriptively are fine.)
        expect(src).not.toMatch(/ElementUtils\s*\./);
    });

    // Integration-style coverage for the IAffectedElement callback contract:
    // the inlined @adguard/extended-css apply IIFE invokes beforeStyleApplied
    // with { node: Element, rules: { style: CSSStyleDeclaration }[] }. The
    // "sends a SaveCssHitsStats message ..." test above exercises this real
    // contract end-to-end (marker flows rules[].style.content -> message),
    // so a drift in the callback argument shape fails the suite. This pins
    // the expected shape explicitly.
    it('exercises the real beforeStyleApplied IAffectedElement contract { node, rules }', async () => {
        document.body.innerHTML = '<div class="ad"><span class="child">ad</span></div>';

        extCssInjectedApply([MARKER_RULE], true, EXTCSS_PROTOCOL);

        // Flush microtasks so the deferred sendMessage is recorded by the spy.
        await new Promise((resolve) => { setTimeout(resolve, 0); });

        // If the inlined bundle passed a differently-shaped object, the
        // content marker would never be read and no message would be sent.
        expect(sendMessageSpy).toHaveBeenCalledTimes(1);
        const msg = sendMessageSpy.mock.calls[0][0] as any;
        expect(msg.payload[0].filterId).toBe(1);
        expect(msg.payload[0].ruleIndex).toBe(2);
        // node was an Element with localName 'div' and a class attribute.
        expect(msg.payload[0].element).toBe('<div class="ad">');
    });

    // Regression: the per-node dedup guard must prevent duplicate hits when
    // the same element is re-styled by the throttled MutationObserver. The
    // applied copy of the rule loses the marker, and the node/rule pair is
    // tracked, so a second beforeStyleApplied call reports nothing.
    it('does not send duplicate hits for the same element and rule', async () => {
        document.body.innerHTML = '<div class="ad"><span class="child">ad</span></div>';

        extCssInjectedApply([MARKER_RULE], true, EXTCSS_PROTOCOL);

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

        extCssInjectedApply([MARKER_RULE], true, EXTCSS_PROTOCOL);

        await new Promise((resolve) => { setTimeout(resolve, 0); });
        expect(sendMessageSpy).toHaveBeenCalledTimes(1);

        // A second injection into the same document — e.g. `onCommitted`
        // firing while `processOpenTabs` is still running — receives the same
        // marker-carrying rule strings. The retained per-node dedupe state must
        // keep the hit above from being reported again.
        extCssInjectedApply([MARKER_RULE], true, EXTCSS_PROTOCOL);

        await new Promise((resolve) => { setTimeout(resolve, 0); });
        expect(sendMessageSpy).toHaveBeenCalledTimes(1);
    });

    it('reports hits for elements matched after a re-injection', async () => {
        document.body.innerHTML = '<div id="first" class="ad"><span class="child">ad</span></div>';

        extCssInjectedApply([MARKER_RULE], true, EXTCSS_PROTOCOL);

        await new Promise((resolve) => { setTimeout(resolve, 0); });
        expect(sendMessageSpy).toHaveBeenCalledTimes(1);

        // The re-injection replaces the instance, so the callback must be
        // registered again: elements matched for the first time by the new
        // instance would otherwise never be reported.
        extCssInjectedApply([MARKER_RULE], true, EXTCSS_PROTOCOL);

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
    // ElementUtils.elementToString. See the shared contract test in
    // css-hits-protocol.test.ts.
    it('correctly escapes double-quotes in attribute values when serializing element', async () => {
        // Single-quoted HTML attribute value containing a literal "
        document.body.innerHTML = '<div data-x=\'a"b\' class="ad"><span class="child">ad</span></div>';

        extCssInjectedApply([MARKER_RULE], true, EXTCSS_PROTOCOL);

        // Flush microtasks so the deferred sendMessage is recorded by the spy.
        await new Promise((resolve) => { setTimeout(resolve, 0); });

        expect(sendMessageSpy).toHaveBeenCalledTimes(1);
        const msg = sendMessageSpy.mock.calls[0][0] as any;
        // The serialized element must escape the " in the data-x value.
        expect(msg.payload[0].element).toBe('<div data-x="a\\"b" class="ad">');
    });
});
