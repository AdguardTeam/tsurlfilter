import {
    afterEach,
    describe,
    expect,
    it,
    vi,
} from 'vitest';

import { CosmeticController } from '../../../../src/lib/mv3/content-script/cosmetic-controller';

const { sendAppMessageMock, cssHitsCounterCtorSpy } = vi.hoisted(() => ({
    sendAppMessageMock: vi.fn(),
    // Used as a constructor (`new CssHitsCounter(cb, options)`); a plain
    // vi.fn() can be `new`-ed and records its constructor call arguments.
    cssHitsCounterCtorSpy: vi.fn(),
}));
vi.mock('../../../../src/lib/common/content-script/send-app-message', () => ({
    sendAppMessage: sendAppMessageMock,
}));

vi.mock('../../../../src/lib/common/content-script/css-hits-counter', () => ({
    CssHitsCounter: cssHitsCounterCtorSpy,
}));

vi.mock('../../../../src/lib/common/utils/selector-validator', () => ({
    validateSelectors: vi.fn(() => ({
        valid: ['.valid-sel'],
        invalid: ['.invalid-sel'],
    })),
}));

describe('MV3 CosmeticController — native CSS repair', () => {
    afterEach(() => {
        vi.useRealTimers();
        vi.restoreAllMocks();
        sendAppMessageMock.mockReset();
        cssHitsCounterCtorSpy.mockClear();
    });

    it('retries GetCosmeticData until isAppStarted is true, then repairs native CSS', async () => {
        vi.useFakeTimers();
        document.head.innerHTML = '';
        sendAppMessageMock
            .mockResolvedValueOnce({
                isAppStarted: false,
                areHitsStatsCollected: false,
                extCssRules: null,
                nativeCssSelectors: null,
            })
            .mockResolvedValueOnce({
                isAppStarted: true,
                areHitsStatsCollected: false,
                extCssRules: null,
                nativeCssSelectors: ['.some-sel'],
            });

        const cosmeticController = new CosmeticController();
        cosmeticController.init();

        // First call returns isAppStarted:false → schedules a 100ms retry.
        await vi.advanceTimersByTimeAsync(0);
        expect(sendAppMessageMock).toHaveBeenCalledTimes(1);
        // No repair yet.
        expect(document.querySelector('style')).toBeNull();

        // Advance past the 100ms retry interval → next call returns
        // isAppStarted:true.
        await vi.advanceTimersByTimeAsync(100);
        expect(sendAppMessageMock).toHaveBeenCalledTimes(2);

        // Native CSS repair ran once the engine was ready.
        const style = document.querySelector('style');
        expect(style).not.toBeNull();
        expect(style?.textContent).toContain('.valid-sel');

        // No further retries are scheduled once isAppStarted is true.
        await vi.advanceTimersByTimeAsync(1000);
        expect(sendAppMessageMock).toHaveBeenCalledTimes(2);
    });

    it('retries when the background engine is not started yet (undefined response)', async () => {
        vi.useFakeTimers();
        document.head.innerHTML = '';
        // The message handler returns `undefined` until tsWebExtension.isStarted.
        sendAppMessageMock
            .mockResolvedValueOnce(undefined)
            .mockResolvedValueOnce({
                isAppStarted: true,
                areHitsStatsCollected: false,
                extCssRules: null,
                nativeCssSelectors: ['.some-sel'],
            });

        const cosmeticController = new CosmeticController();
        cosmeticController.init();

        await vi.advanceTimersByTimeAsync(0);
        expect(sendAppMessageMock).toHaveBeenCalledTimes(1);
        expect(document.querySelector('style')).toBeNull();

        await vi.advanceTimersByTimeAsync(100);
        expect(sendAppMessageMock).toHaveBeenCalledTimes(2);
        expect(document.querySelector('style')).not.toBeNull();
    });

    it('stops retrying after MAX_GET_COSMETIC_DATA_TRIES attempts', async () => {
        vi.useFakeTimers();
        document.head.innerHTML = '';
        sendAppMessageMock.mockResolvedValue({
            isAppStarted: false,
            areHitsStatsCollected: false,
            extCssRules: null,
            nativeCssSelectors: null,
        });

        const cosmeticController = new CosmeticController();
        cosmeticController.init();

        // Advance well beyond the whole backoff window (11 requests, ~26s).
        await vi.advanceTimersByTimeAsync(30_000);

        // 1 initial call + 10 retries while tries < MAX_GET_COSMETIC_DATA_TRIES
        // (10): tries 0..9 retry, tries 10 falls through and stops.
        expect(sendAppMessageMock).toHaveBeenCalledTimes(11);

        // No style was injected (the engine never became ready).
        expect(document.querySelector('style')).toBeNull();
    });

    it('backs off between retries instead of using a fixed interval', async () => {
        vi.useFakeTimers();
        document.head.innerHTML = '';
        // A permanent `undefined` response, e.g. the app was stopped.
        sendAppMessageMock.mockResolvedValue(undefined);

        const cosmeticController = new CosmeticController();
        cosmeticController.init();

        await vi.advanceTimersByTimeAsync(0);
        expect(sendAppMessageMock).toHaveBeenCalledTimes(1);

        // First retry after the base timeout.
        await vi.advanceTimersByTimeAsync(100);
        expect(sendAppMessageMock).toHaveBeenCalledTimes(2);

        // Second retry after 200ms, not another 100ms.
        await vi.advanceTimersByTimeAsync(100);
        expect(sendAppMessageMock).toHaveBeenCalledTimes(2);

        await vi.advanceTimersByTimeAsync(100);
        expect(sendAppMessageMock).toHaveBeenCalledTimes(3);
    });

    it('still repairs invalid native CSS selectors', async () => {
        vi.useFakeTimers();
        document.head.innerHTML = '';
        sendAppMessageMock.mockResolvedValue({
            isAppStarted: true,
            areHitsStatsCollected: false,
            extCssRules: null,
            nativeCssSelectors: ['.some-sel'],
        });

        const cosmeticController = new CosmeticController();
        cosmeticController.init();
        await vi.advanceTimersByTimeAsync(0);

        const style = document.querySelector('style');
        expect(style).not.toBeNull();
        expect(style?.textContent).toContain('.valid-sel');
    });
});

describe('MV3 CosmeticController — native CssHitsCounter', () => {
    afterEach(() => {
        vi.useRealTimers();
        vi.restoreAllMocks();
        sendAppMessageMock.mockReset();
        cssHitsCounterCtorSpy.mockClear();
    });

    it('creates a CssHitsCounter when areHitsStatsCollected is true and the app is started', async () => {
        vi.useFakeTimers();
        document.head.innerHTML = '';
        sendAppMessageMock.mockResolvedValue({
            isAppStarted: true,
            areHitsStatsCollected: true,
            extCssRules: null,
            nativeCssSelectors: null,
        });

        const cosmeticController = new CosmeticController();
        cosmeticController.init();
        await vi.advanceTimersByTimeAsync(0);

        expect(cssHitsCounterCtorSpy).toHaveBeenCalledTimes(1);
        // The counter must receive the probe collector of the controller.
        expect(cssHitsCounterCtorSpy.mock.calls[0][1]).toEqual({
            pendingProbesCollector: expect.anything(),
        });
    });

    it('does NOT create a CssHitsCounter when areHitsStatsCollected is false', async () => {
        vi.useFakeTimers();
        document.head.innerHTML = '';
        sendAppMessageMock.mockResolvedValue({
            isAppStarted: true,
            areHitsStatsCollected: false,
            extCssRules: null,
            nativeCssSelectors: null,
        });

        const cosmeticController = new CosmeticController();
        cosmeticController.init();
        await vi.advanceTimersByTimeAsync(0);

        expect(cssHitsCounterCtorSpy).not.toHaveBeenCalled();
    });

    it('sends SaveCssHitsStats messages through the counter callback', async () => {
        vi.useFakeTimers();
        document.head.innerHTML = '';
        sendAppMessageMock.mockResolvedValue({
            isAppStarted: true,
            areHitsStatsCollected: true,
            extCssRules: null,
            nativeCssSelectors: null,
        });

        const cosmeticController = new CosmeticController();
        cosmeticController.init();
        await vi.advanceTimersByTimeAsync(0);

        expect(cssHitsCounterCtorSpy).toHaveBeenCalledTimes(1);
        // Grab the callback handed to the counter and simulate a counted hit.
        const hitsCallback = cssHitsCounterCtorSpy.mock.calls[0][0] as (stats: unknown) => void;
        const stats = [{ filterId: 1, ruleIndex: 2, element: '<div class="ad">' }];
        hitsCallback(stats);

        expect(sendAppMessageMock).toHaveBeenCalledWith({
            type: 'saveCssHitsStats',
            payload: stats,
        });
    });

    it('does not create a duplicate CssHitsCounter on retry (idempotent)', async () => {
        vi.useFakeTimers();
        document.head.innerHTML = '';
        sendAppMessageMock.mockResolvedValue({
            isAppStarted: true,
            areHitsStatsCollected: true,
            extCssRules: null,
            nativeCssSelectors: null,
        });

        const cosmeticController = new CosmeticController();
        cosmeticController.init();
        await vi.advanceTimersByTimeAsync(0);
        expect(cssHitsCounterCtorSpy).toHaveBeenCalledTimes(1);

        // A second init() (same document) must not create another counter.
        cosmeticController.init();
        await vi.advanceTimersByTimeAsync(0);

        expect(cssHitsCounterCtorSpy).toHaveBeenCalledTimes(1);
    });
});
