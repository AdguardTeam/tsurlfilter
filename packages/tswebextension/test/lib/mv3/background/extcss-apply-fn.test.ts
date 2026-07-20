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

import { EXTCSS_PROTOCOL, type ExtCssProtocol } from '../../../../src/lib/common/message-constants';
import { applyExtCss, disposeExtCss } from '../../../../src/lib/mv3/background/extcss-apply-fn';

// Single file-level cleanup. The jsdom `window` is shared across
// every test in this file, so a retained `window['__adguardExtCss']` instance
// (and its MutationObserver) would leak into the next test. Dispose it and
// reset the DOM here for every test, instead of repeating the teardown per
// describe block.
afterEach(() => {
    // eslint-disable-next-line no-underscore-dangle -- deliberate marker matching the retained-instance key
    const handle = (window as unknown as { __adguardExtCss?: { dispose(): void } | null }).__adguardExtCss;
    if (handle) {
        try {
            handle.dispose();
        } catch {
            // ignore
        }
    }
    // eslint-disable-next-line no-underscore-dangle -- deliberate marker matching the retained-instance key
    (window as unknown as { __adguardExtCss?: null }).__adguardExtCss = null;
    document.body.innerHTML = '';
});

describe('applyExtCss (inlined bundle)', () => {
    it('hides a matching :has() element after being called', () => {
        document.body.innerHTML = '<div class="ad"><span class="child">ad</span></div>';

        applyExtCss(['.ad:has(.child) { display: none !important; }'], false, EXTCSS_PROTOCOL);

        const ad = document.querySelector('.ad') as HTMLElement;
        expect(ad.style.getPropertyValue('display')).toBe('none');
        expect(ad.style.getPropertyPriority('display')).toBe('important');
    });

    it('hides a matching :contains() element (exercises init())', () => {
        // `:contains()` requires the `init()` lifecycle step (it snapshots the
        // native `Node.prototype.textContent` getter), so this test fails if
        // the inlined payload calls `apply()` without `init()`.
        document.body.innerHTML = '<div class="ad">adsbygoogle</div>';

        applyExtCss(['.ad:contains(adsbygoogle) { display: none !important; }'], false, EXTCSS_PROTOCOL);

        const ad = document.querySelector('.ad') as HTMLElement;
        expect(ad.style.getPropertyValue('display')).toBe('none');
        expect(ad.style.getPropertyPriority('display')).toBe('important');
    });

    it('does not hide non-matching elements', () => {
        document.body.innerHTML = '<div class="ad"><span class="other">ad</span></div>';

        applyExtCss(['.ad:has(.child) { display: none !important; }'], false, EXTCSS_PROTOCOL);

        const ad = document.querySelector('.ad') as HTMLElement;
        expect(ad.style.getPropertyValue('display')).toBe('');
    });

    it('is a self-contained function (toString contains the inlined engine)', () => {
        // The inlined IIFE assigns `applyExtendedCss`; ensure the engine code
        // is embedded in the function source so it survives executeScript
        // serialization (closure variables would not).
        expect(String(applyExtCss)).toContain('applyExtendedCss');
    });

    it('is self-contained — the instance key arrives via the protocol argument', () => {
        // applyExtCss is serialized via Function.toString() and re-executed in the
        // page's ISOLATED world by executeScript({ func }). Any module-scope
        // identifier referenced in the body becomes a free identifier there
        // (ReferenceError, or `undefined`), so the retain/dispose key MUST
        // arrive via the serialized `protocol` argument — not as a body
        // literal duplicated across call sites, and not as a module-scope ref.
        const src = String(applyExtCss);
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
        expect(String(applyExtCss)).toContain('$&');
        // The marker call must not survive inlining.
        expect(String(applyExtCss)).not.toContain('__INLINE_EXTCSS_BUNDLE__');
    });

    it('hides a matching :matches-css() element (exercises escapeRegExp)', () => {
        // `:matches-css()` builds a regex from the declared value via
        // `escapeRegExp`, which contains `$&`. jsdom normalizes `color: red`
        // to `rgb(255, 0, 0)` (parentheses are regex metacharacters that
        // `escapeRegExp` must escape), so this rule only hides the element when
        // the inlined engine is intact. With the corrupted inliner the
        // escaped value becomes garbage and the regex no longer matches.
        document.body.innerHTML = '<div class="ad" style="color: red">ad</div>';

        applyExtCss(['.ad:matches-css(color: rgb(255, 0, 0)) { display: none !important; }'], false, EXTCSS_PROTOCOL);

        const ad = document.querySelector('.ad') as HTMLElement;
        expect(ad.style.getPropertyValue('display')).toBe('none');
        expect(ad.style.getPropertyPriority('display')).toBe('important');
    });
});

describe('applyExtCss — navigation cleanup (AC2)', () => {
    it('disposes the previous instance on re-apply (old styles reverted, old observer stopped)', async () => {
        // First injection: rule A hides `.ad:has(.child)`.
        document.body.innerHTML = '<div class="ad"><span class="child">ad</span></div>';
        applyExtCss(['.ad:has(.child) { display: none !important; }'], false, EXTCSS_PROTOCOL);
        const ad = document.querySelector('.ad') as HTMLElement;
        expect(ad.style.getPropertyValue('display')).toBe('none');

        // Second injection (simulates the next onCommitted re-injection with a
        // different rule set for the new URL). The previous instance must be
        // disposed: its styles are reverted synchronously by dispose().
        applyExtCss(['.other:has(.x) { display: none !important; }'], false, EXTCSS_PROTOCOL);

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

describe('applyExtCss — continuous observation (AC1)', () => {
    it('hides a matching element added dynamically after applyExtCss', async () => {
        document.body.innerHTML = '';
        applyExtCss(['.ad:has(.child) { display: none !important; }'], false, EXTCSS_PROTOCOL);

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

describe('applyExtCss — CSS hits stats', () => {
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

        applyExtCss([MARKER_RULE], true, EXTCSS_PROTOCOL);

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

    it('uses .catch() — not try/catch — to swallow the async sendMessage rejection', () => {
        const src = String(applyExtCss);
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
            applyExtCss([MARKER_RULE], true, EXTCSS_PROTOCOL);

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

        applyExtCss(['.ad:has(.child) { display: none !important; }'], false, EXTCSS_PROTOCOL);

        expect(sendMessageSpy).not.toHaveBeenCalled();
    });

    it('is self-contained — protocol literals arrive via the protocol argument', () => {
        const src = String(applyExtCss);
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
        const customProtocol: ExtCssProtocol = {
            markerPrefix: 'custommarker',
            handlerName: 'customHandler',
            messageType: 'customCssHitsType',
            // eslint-disable-next-line no-underscore-dangle -- deliberate test marker key
            instanceKey: '__customExtCss',
        };
        const customMarkerRule = '.ad:has(.child) { display: none !important; '
            + 'content: \'custommarker1%3B2\' !important; }';

        try {
            applyExtCss([customMarkerRule], true, customProtocol);

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
        const src = String(applyExtCss);

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

        applyExtCss([MARKER_RULE], true, EXTCSS_PROTOCOL);

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

    // Regression: the dedup guard (rule.style.content = '') must prevent
    // duplicate hits when the same element is re-styled by the throttled
    // MutationObserver. After the first hit clears the content marker,
    // subsequent beforeStyleApplied calls find an empty string and skip.
    it('does not send duplicate hits (dedup via content clearing)', async () => {
        document.body.innerHTML = '<div class="ad"><span class="child">ad</span></div>';

        applyExtCss([MARKER_RULE], true, EXTCSS_PROTOCOL);

        // Flush microtasks so the deferred sendMessage is recorded by the spy.
        await new Promise((resolve) => { setTimeout(resolve, 0); });

        expect(sendMessageSpy).toHaveBeenCalledTimes(1);

        // Wait for the throttled MutationObserver to run.
        // If the dedup guard fails (content not cleared), the observer
        // would re-send the hit on its next pass.
        await new Promise((resolve) => { setTimeout(resolve, 300); });
        expect(sendMessageSpy).toHaveBeenCalledTimes(1);
    });

    // Regression: attribute values containing double-quotes must be escaped
    // (\" -> backslash-quote) in the element serialization, matching MV2's
    // ElementUtils.elementToString. See the shared contract test in
    // css-hits-protocol.test.ts.
    it('correctly escapes double-quotes in attribute values when serializing element', async () => {
        // Single-quoted HTML attribute value containing a literal "
        document.body.innerHTML = '<div data-x=\'a"b\' class="ad"><span class="child">ad</span></div>';

        applyExtCss([MARKER_RULE], true, EXTCSS_PROTOCOL);

        // Flush microtasks so the deferred sendMessage is recorded by the spy.
        await new Promise((resolve) => { setTimeout(resolve, 0); });

        expect(sendMessageSpy).toHaveBeenCalledTimes(1);
        const msg = sendMessageSpy.mock.calls[0][0] as any;
        // The serialized element must escape the " in the data-x value.
        expect(msg.payload[0].element).toBe('<div data-x="a\\"b" class="ad">');
    });
});

describe('disposeExtCss — empty transition disposal', () => {
    it('disposes the previous instance (styles reverted, key cleared)', () => {
        // First injection: rule hides `.ad:has(.child)`.
        document.body.innerHTML = '<div class="ad"><span class="child">ad</span></div>';
        applyExtCss(['.ad:has(.child) { display: none !important; }'], false, EXTCSS_PROTOCOL);
        const ad = document.querySelector('.ad') as HTMLElement;
        expect(ad.style.getPropertyValue('display')).toBe('none');

        // The rule set transitioned from non-empty to empty on a same-document
        // navigation — the background injects disposeExtCss. The retained
        // instance must be disposed: its styles are reverted synchronously.
        disposeExtCss(EXTCSS_PROTOCOL);

        // Old instance's styles reverted → `.ad` is visible again.
        expect(ad.style.getPropertyValue('display')).toBe('');
        // The retained-instance key is cleared.
        // eslint-disable-next-line no-underscore-dangle -- deliberate marker matching the retained-instance key
        expect((window as unknown as { __adguardExtCss?: unknown }).__adguardExtCss).toBeNull();
    });

    it('stops the old observer — newly added matching nodes are NOT hidden', async () => {
        document.body.innerHTML = '';
        applyExtCss(['.ad:has(.child) { display: none !important; }'], false, EXTCSS_PROTOCOL);

        disposeExtCss(EXTCSS_PROTOCOL);

        // Append a matching element after disposal: the (disconnected)
        // MutationObserver must not hide it.
        const ad = document.createElement('div');
        ad.className = 'ad';
        ad.innerHTML = '<span class="child">ad</span>';
        document.body.appendChild(ad);

        // Give any (disposed) observer a chance to run.
        await new Promise((resolve) => { setTimeout(resolve, 250); });
        expect((ad as HTMLElement).style.getPropertyValue('display')).toBe('');
    });

    it('is a no-op when no instance is retained', () => {
        // Must not throw when the window key was never set.
        expect(() => disposeExtCss(EXTCSS_PROTOCOL)).not.toThrow();
    });

    it('tolerates a retained instance whose dispose() throws', () => {
        const w = window as unknown as Record<string, unknown>;
        // eslint-disable-next-line no-underscore-dangle -- deliberate marker matching the retained-instance key
        w.__adguardExtCss = {
            dispose(): void {
                throw new Error('dispose failed');
            },
        };

        expect(() => disposeExtCss(EXTCSS_PROTOCOL)).not.toThrow();
        // The key is cleared even when dispose() threw.
        // eslint-disable-next-line no-underscore-dangle -- deliberate marker matching the retained-instance key
        expect(w.__adguardExtCss).toBeNull();
    });

    it('is self-contained — the instance key arrives via the protocol argument', () => {
        const src = String(disposeExtCss);
        expect(src).toContain('protocol.instanceKey');
        expect(src).not.toContain('__adguardExtCss');
        expect(src).not.toContain('EXTCSS_PROTOCOL');
    });
});
