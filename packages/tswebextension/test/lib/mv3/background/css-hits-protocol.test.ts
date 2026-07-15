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

import { ElementUtils } from '../../../../src/lib/common/content-script/utils/element-utils';
import { applyExtCss } from '../../../../src/lib/mv3/background/extcss-apply-fn';

/**
 * Shared protocol contract test: asserts the MV3 injected `beforeStyleApplied`
 * callback produces identical { filterId, ruleIndex, element } output to MV2's
 * ElementUtils.parseExtendedStyleInfo + ElementUtils.elementToString for the
 * same marker inputs.
 *
 * This test replaces the "keep in sync" comment as the guard against drift.
 * If either implementation changes, this test fails.
 *
 * MV2 path: ElementUtils.parseExtendedStyleInfo(content, 'adguard') +
 *           ElementUtils.elementToString(element) — the reference parsing
 *           used by the MV2 content-script CssHitsCounter.
 *
 * MV3 path: applyExtCss([markerRule], true) — the background-injected func
 *           whose beforeStyleApplied callback parses the same marker and
 *           serializes the element identically.
 */

describe('CSS-hits marker protocol: MV2 vs MV3 contract', () => {
    const PREFIX = 'adguard';

    // Builds a marker CSS rule that triggers the CSS-hits
    // beforeStyleApplied callback. The content value uses URI-encoded ';'
    // (%3B) to match the buildStyleSheetsWithHits emitter output.
    const buildMarkerRule = (
        filterId: number,
        ruleIndex: number,
        selector = '.ad:has(.child)',
    ): string => `${selector} { display: none !important; content: '${PREFIX}${filterId}%3B${ruleIndex}' !important; }`;

    let sendMessageSpy: ReturnType<typeof vi.spyOn>;

    beforeEach(() => {
        sendMessageSpy = vi.spyOn(chrome.runtime, 'sendMessage');
    });

    // Single file-level cleanup. The jsdom `window` is shared across
    // every test in this file, so a retained `window['__adguardExtCss']` instance
    // (and its MutationObserver) would leak into the next test.
    afterEach(() => {
        sendMessageSpy.mockRestore();
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

    // Flush microtasks so the deferred sendMessage (via Promise.resolve().then(...))
    // is recorded by the spy before assertions.
    const flushMicrotasks = async (): Promise<void> => {
        await new Promise((resolve) => { setTimeout(resolve, 0); });
    };

    it('both paths parse a basic marker identically', async () => {
        const filterId = 1;
        const ruleIndex = 42;
        // Raw content value as stored in rule.style.content (single-quoted).
        const rawContent = `'${PREFIX}${filterId}%3B${ruleIndex}'`;

        // MV2 path
        const mv2 = ElementUtils.parseExtendedStyleInfo(rawContent, PREFIX);
        expect(mv2).toEqual({ filterId, ruleIndex });

        // MV3 end-to-end path
        document.body.innerHTML = '<div class="ad"><span class="child">ad</span></div>';
        applyExtCss([buildMarkerRule(filterId, ruleIndex)], true);

        await flushMicrotasks();

        expect(sendMessageSpy).toHaveBeenCalledTimes(1);
        const msg = sendMessageSpy.mock.calls[0][0] as any;
        expect(msg.payload[0].filterId).toBe(filterId);
        expect(msg.payload[0].ruleIndex).toBe(ruleIndex);
    });

    it('both paths handle !important suffix in content identically', async () => {
        const filterId = 5;
        const ruleIndex = 100;
        // Content value with !important suffix (as the style declaration may include it).
        const rawContent = `'${PREFIX}${filterId}%3B${ruleIndex}' !important`;

        // MV2 path
        const mv2 = ElementUtils.parseExtendedStyleInfo(rawContent, PREFIX);
        expect(mv2).toEqual({ filterId, ruleIndex });

        // MV3 end-to-end path (CSS rule has !important on the content declaration)
        document.body.innerHTML = '<div class="ad"><span class="child">ad</span></div>';
        applyExtCss([buildMarkerRule(filterId, ruleIndex)], true);

        await flushMicrotasks();

        expect(sendMessageSpy).toHaveBeenCalledTimes(1);
        const msg = sendMessageSpy.mock.calls[0][0] as any;
        expect(msg.payload[0].filterId).toBe(filterId);
        expect(msg.payload[0].ruleIndex).toBe(ruleIndex);
    });

    it('both paths reject a content value without the adguard prefix', async () => {
        const rawContent = '"unknown1%3B2"';

        // MV2 path
        const mv2 = ElementUtils.parseExtendedStyleInfo(rawContent, PREFIX);
        expect(mv2).toBeNull();

        // MV3 path: no sendMessage because the marker does not match
        document.body.innerHTML = '<div class="ad"><span class="child">ad</span></div>';
        applyExtCss(
            ['.ad:has(.child) { display: none !important; content: "unknown1%3B2" !important; }'],
            true,
        );

        await flushMicrotasks();

        expect(sendMessageSpy).not.toHaveBeenCalled();
    });

    it('both paths serialize a single-attribute element identically', async () => {
        document.body.innerHTML = '<div class="ad"><span class="child">ad</span></div>';
        const el = document.querySelector('.ad') as HTMLElement;

        // MV2 elementToString
        const mv2Str = ElementUtils.elementToString(el);
        expect(mv2Str).toBe('<div class="ad">');

        // MV3 end-to-end: the serialized element is in the sendMessage payload
        applyExtCss([buildMarkerRule(1, 2)], true);

        await flushMicrotasks();

        const msg = sendMessageSpy.mock.calls[0][0] as any;
        expect(msg.payload[0].element).toBe(mv2Str);
    });

    it('both paths escape double-quotes in attribute values identically', async () => {
        // Create an element with a double-quote in an attribute value.
        document.body.innerHTML = '<div data-x=\'a"b\' class="ad"><span class="child">ad</span></div>';
        const el = document.querySelector('.ad') as HTMLElement;

        // MV2 elementToString
        const mv2Str = ElementUtils.elementToString(el);
        // Both implementations escape " as \"
        expect(mv2Str).toBe('<div data-x="a\\"b" class="ad">');

        // MV3 end-to-end
        applyExtCss([buildMarkerRule(1, 2)], true);

        await flushMicrotasks();

        const msg = sendMessageSpy.mock.calls[0][0] as any;
        expect(msg.payload[0].element).toBe(mv2Str);
    });

    it('both paths serialize multiple attributes identically', async () => {
        document.body.innerHTML = '<div class="ad" id="banner" data-x="test"><span class="child">ad</span></div>';
        const el = document.querySelector('.ad') as HTMLElement;

        // MV2 elementToString
        const mv2Str = ElementUtils.elementToString(el);

        // MV3 end-to-end
        applyExtCss([buildMarkerRule(1, 2)], true);

        await flushMicrotasks();

        const msg = sendMessageSpy.mock.calls[0][0] as any;
        expect(msg.payload[0].element).toBe(mv2Str);
    });
});
