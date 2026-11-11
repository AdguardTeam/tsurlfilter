import {
    afterEach,
    beforeEach,
    describe,
    expect,
    it,
    vi,
} from 'vitest';

import { EXTCSS_PROTOCOL } from '../../src/lib/common/extcss-protocol';
// Installs the engine on the page the way the background does: the prebuilt
// script asset is injected before the rule strings, and the code string reads
// the engine back from it.
import '../../src/lib/common/extcss-engine';
import { serializeExtCssDisposeForCode, serializeExtCssForCode } from '../../src/lib/mv2/background/extcss-code';

/**
 * Returns the ExtendedCss instance retained on `window` by the payload.
 *
 * @returns The retained instance, or null when nothing was applied.
 */
const getRetainedInstance = (): unknown => (window as unknown as Record<string, unknown>)[EXTCSS_PROTOCOL.instanceKey];

/**
 * Evaluates a serialized code string in the page, the way the browser's
 * `tabs.executeScript({ code })` parser does.
 *
 * @param code Code string to evaluate.
 *
 * @returns The apply result returned by the evaluated expression.
 */
const evaluateCode = (code: string): unknown => {
    // Deliberate indirect eval: match executeScript completion-value semantics.
    // eslint-disable-next-line no-eval
    return (0, eval)(code);
};

describe('MV2 ExtCSS code string in Firefox', () => {
    let sendMessage: ReturnType<typeof vi.fn>;

    beforeEach(() => {
        sendMessage = vi.fn();
        (window as unknown as { chrome: unknown }).chrome = {
            runtime: {
                sendMessage,
            },
        };
        document.body.innerHTML = '';
    });

    afterEach(() => {
        const instance = getRetainedInstance() as { dispose?: () => void } | null;
        instance?.dispose?.();
        (window as unknown as Record<string, unknown>)[EXTCSS_PROTOCOL.instanceKey] = null;
        document.body.innerHTML = '';
        delete (window as unknown as { chrome?: unknown }).chrome;
        vi.restoreAllMocks();
    });

    it('applies the serialized code string and hides a matching :has() element', () => {
        document.body.innerHTML = '<div class="ad"><span class="child"></span></div>';

        evaluateCode(serializeExtCssForCode(
            ['.ad:has(.child) { display: none !important; }'],
            false,
            EXTCSS_PROTOCOL,
        ));

        const ad = document.querySelector('.ad') as HTMLElement;
        expect(getComputedStyle(ad).display).toBe('none');
    });

    it('reports a CSS hit through saveCssHitsStats when stats are collected', async () => {
        document.body.innerHTML = '<div class="ad"><span class="child"></span></div>';

        evaluateCode(serializeExtCssForCode(
            ['.ad:has(.child) { display: none !important; content: \'adguard1%3B2\' !important; }'],
            true,
            EXTCSS_PROTOCOL,
        ));

        // Flush the deferred sendMessage microtask.
        await new Promise((resolve) => {
            setTimeout(resolve, 0);
        });

        expect(sendMessage).toHaveBeenCalledTimes(1);
        expect(sendMessage).toHaveBeenCalledWith({
            handlerName: 'tsWebExtension',
            type: 'saveCssHitsStats',
            payload: [{ filterId: 1, ruleIndex: 2, element: '<div class="ad">' }],
        });
    });

    it('disposes the retained instance and reverts the applied styles', () => {
        document.body.innerHTML = '<div class="ad"><span class="child"></span></div>';

        evaluateCode(serializeExtCssForCode(
            ['.ad:has(.child) { display: none !important; }'],
            false,
            EXTCSS_PROTOCOL,
        ));

        const ad = document.querySelector('.ad') as HTMLElement;
        expect(getComputedStyle(ad).display).toBe('none');
        expect(getRetainedInstance()).not.toBeNull();

        evaluateCode(serializeExtCssDisposeForCode(EXTCSS_PROTOCOL));

        expect(getComputedStyle(ad).display).toBe('block');
        expect(getRetainedInstance()).toBeNull();
    });

    it('reports a failure instead of applying when the engine asset was not loaded', () => {
        document.body.innerHTML = '<div class="ad"><span class="child"></span></div>';
        const engine = window[EXTCSS_PROTOCOL.engineKey];
        delete window[EXTCSS_PROTOCOL.engineKey];

        try {
            const result = evaluateCode(serializeExtCssForCode(
                ['.ad:has(.child) { display: none !important; }'],
                false,
                EXTCSS_PROTOCOL,
            ));

            expect(result).toEqual({
                error: EXTCSS_PROTOCOL.applyErrors.engineNotLoaded,
                message: expect.stringContaining('ExtendedCss engine is not loaded'),
            });

            const ad = document.querySelector('.ad') as HTMLElement;
            expect(getComputedStyle(ad).display).toBe('block');
            expect(getRetainedInstance()).toBeNull();
        } finally {
            window[EXTCSS_PROTOCOL.engineKey] = engine;
        }
    });
});
