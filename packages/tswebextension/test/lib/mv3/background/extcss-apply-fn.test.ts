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

import { applyExtCss } from '../../../../src/lib/mv3/background/extcss-apply-fn';

// Single file-level cleanup (finding 2). The jsdom `window` is shared across
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

        applyExtCss(['.ad:has(.child) { display: none !important; }']);

        const ad = document.querySelector('.ad') as HTMLElement;
        expect(ad.style.getPropertyValue('display')).toBe('none');
        expect(ad.style.getPropertyPriority('display')).toBe('important');
    });

    it('does not hide non-matching elements', () => {
        document.body.innerHTML = '<div class="ad"><span class="other">ad</span></div>';

        applyExtCss(['.ad:has(.child) { display: none !important; }']);

        const ad = document.querySelector('.ad') as HTMLElement;
        expect(ad.style.getPropertyValue('display')).toBe('');
    });

    it('is a self-contained function (toString contains the inlined engine)', () => {
        // The inlined IIFE assigns `applyExtendedCss`; ensure the engine code
        // is embedded in the function source so it survives executeScript
        // serialization (closure variables would not).
        expect(String(applyExtCss)).toContain('applyExtendedCss');
    });

    it('is self-contained — inlines the instance key with no module-scope references', () => {
        // applyExtCss is serialized via Function.toString() and re-executed in the
        // page's ISOLATED world by executeScript({ func }). Any module-scope
        // identifier referenced in the body becomes a free identifier there
        // (ReferenceError, or `undefined`), so `w[EXTCSS_INSTANCE_KEY]` would
        // read/write the wrong key and silently break the retain/dispose logic.
        // The instance key MUST therefore be a literal inside the body.
        expect(String(applyExtCss)).toContain('__adguardExtCss');
        expect(String(applyExtCss)).not.toContain('EXTCSS_INSTANCE_KEY');
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

        applyExtCss(['.ad:matches-css(color: rgb(255, 0, 0)) { display: none !important; }']);

        const ad = document.querySelector('.ad') as HTMLElement;
        expect(ad.style.getPropertyValue('display')).toBe('none');
        expect(ad.style.getPropertyPriority('display')).toBe('important');
    });
});

describe('applyExtCss — navigation cleanup (AC2)', () => {
    it('disposes the previous instance on re-apply (old styles reverted, old observer stopped)', async () => {
        // First injection: rule A hides `.ad:has(.child)`.
        document.body.innerHTML = '<div class="ad"><span class="child">ad</span></div>';
        applyExtCss(['.ad:has(.child) { display: none !important; }']);
        const ad = document.querySelector('.ad') as HTMLElement;
        expect(ad.style.getPropertyValue('display')).toBe('none');

        // Second injection (simulates the next onCommitted re-injection with a
        // different rule set for the new URL). The previous instance must be
        // disposed: its styles are reverted synchronously by dispose().
        applyExtCss(['.other:has(.x) { display: none !important; }']);

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
        applyExtCss(['.ad:has(.child) { display: none !important; }']);

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

    it('sends a SaveCssHitsStats message when collectStats is on and a rule carries a marker', () => {
        document.body.innerHTML = '<div class="ad"><span class="child">ad</span></div>';

        applyExtCss([MARKER_RULE], true);

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

    it('registers no beforeStyleApplied and sends no message when collectStats is off', () => {
        document.body.innerHTML = '<div class="ad"><span class="child">ad</span></div>';

        applyExtCss(['.ad:has(.child) { display: none !important; }'], false);

        expect(sendMessageSpy).not.toHaveBeenCalled();
    });

    it('is self-contained — inlines marker literals with no module-scope refs', () => {
        const src = String(applyExtCss);
        // Hit-bridge literals must be inlined verbatim in the serialized body
        // (the transpiler may normalize quote style, so match either quote).
        expect(src).toMatch(/['"]adguard['"]/);
        expect(src).toMatch(/['"]tsWebExtension['"]/);
        expect(src).toMatch(/['"]saveCssHitsStats['"]/);
        // No module-scope identifier leaks for these concepts.
        expect(src).not.toMatch(/\bHANDLER_NAME\b/);
        expect(src).not.toMatch(/\bCONTENT_ATTR_PREFIX\b/);
        expect(src).not.toMatch(/\bSAVE_CSS_HITS_STATS\b/);
    });

    // Integration-style coverage for the IAffectedElement callback contract:
    // the inlined @adguard/extended-css apply IIFE invokes beforeStyleApplied
    // with { node: Element, rules: { style: CSSStyleDeclaration }[] }. The
    // "sends a SaveCssHitsStats message ..." test above exercises this real
    // contract end-to-end (marker flows rules[].style.content -> message),
    // so a drift in the callback argument shape fails the suite. This pins
    // the expected shape explicitly.
    it('exercises the real beforeStyleApplied IAffectedElement contract { node, rules }', () => {
        document.body.innerHTML = '<div class="ad"><span class="child">ad</span></div>';

        applyExtCss([MARKER_RULE], true);

        // If the inlined bundle passed a differently-shaped object, the
        // content marker would never be read and no message would be sent.
        expect(sendMessageSpy).toHaveBeenCalledTimes(1);
        const msg = sendMessageSpy.mock.calls[0][0] as any;
        expect(msg.payload[0].filterId).toBe(1);
        expect(msg.payload[0].ruleIndex).toBe(2);
        // node was an Element with localName 'div' and a class attribute.
        expect(msg.payload[0].element).toBe('<div class="ad">');
    });
});
