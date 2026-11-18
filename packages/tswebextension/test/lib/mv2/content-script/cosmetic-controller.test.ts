/**
 * @vitest-environment jsdom
 */

import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
    afterEach,
    beforeEach,
    describe,
    expect,
    it,
    vi,
} from 'vitest';

import { type ContentScriptCosmeticData, ExtCssMarkersState } from '../../../../src/lib/common/cosmetic-api';
import { CosmeticController } from '../../../../src/lib/mv2/content-script/cosmetic-controller';

const { sendAppMessageMock, cssHitsCounterCtorSpy } = vi.hoisted(() => ({
    sendAppMessageMock: vi.fn(),
    // Used as a constructor (`new CssHitsCounter(cb)`); a plain vi.fn() can be
    // `new`-ed and records its constructor call arguments.
    cssHitsCounterCtorSpy: vi.fn(),
}));
vi.mock('../../../../src/lib/common/content-script/send-app-message', () => ({
    sendAppMessage: sendAppMessageMock,
}));

vi.mock('../../../../src/lib/common/content-script/css-hits-counter', () => ({
    CssHitsCounter: cssHitsCounterCtorSpy,
}));

/**
 * Makes the mocked counter constructor return an instance with the lifecycle
 * methods the shared controller calls.
 */
const mockHitsCounterInstance = (): void => {
    // A constructor that returns an object yields that object, so the mocked
    // counter keeps the lifecycle methods without an explicit class.
    cssHitsCounterCtorSpy.mockImplementation(() => ({
        pause: vi.fn(),
        resume: vi.fn(),
        stop: vi.fn(),
    }));
};

vi.mock('../../../../src/lib/common/utils/selector-validator', () => ({
    validateSelectors: vi.fn(() => ({
        valid: ['.valid-sel'],
        invalid: ['.invalid-sel'],
    })),
}));

// Resolve the source paths relative to THIS test file's directory.
// `readFileSync` resolves relative paths against `process.cwd()` (the package
// root under `pnpm test:mv2`), and `new URL(rel, import.meta.url)` is unreliable
// here because the jsdom test environment makes the URL constructor resolve to
// `http://localhost:3000/...`. Converting `import.meta.url` to a real path and
// joining with `node:path` is robust regardless of the working directory.
const TEST_DIR = path.dirname(fileURLToPath(import.meta.url));

/**
 * Returns the source of a controller, without comments.
 *
 * A comment that names a removed API must not trip the source guard.
 *
 * @param relativePath Path relative to this test file.
 *
 * @returns The controller source.
 */
const readControllerSource = (relativePath: string): string => readFileSync(
    path.resolve(TEST_DIR, relativePath),
    'utf8',
).replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');

const MV2_CONTROLLER_SRC = readControllerSource(
    '../../../../src/lib/mv2/content-script/cosmetic-controller.ts',
);
const SHARED_CONTROLLER_SRC = readControllerSource(
    '../../../../src/lib/common/content-script/cosmetic-controller.ts',
);

/**
 * Builds content-script cosmetic data for the tests.
 *
 * @param overrides Fields to override on the default response.
 *
 * @returns Cosmetic data returned by the mocked background.
 */
const makeCosmeticData = (
    overrides: Partial<ContentScriptCosmeticData> = {},
): ContentScriptCosmeticData => ({
    isAppStarted: true,
    areHitsStatsCollected: false,
    areNativeHitsStatsCollected: false,
    extCssMarkersState: ExtCssMarkersState.ContentScript,
    extCssRules: null,
    nativeCssSelectors: null,
    ...overrides,
});

describe('MV2 CosmeticController — native CSS repair', () => {
    beforeEach(() => {
        mockHitsCounterInstance();
    });

    afterEach(() => {
        vi.useRealTimers();
        vi.restoreAllMocks();
        sendAppMessageMock.mockReset();
        cssHitsCounterCtorSpy.mockClear();
        document.body.innerHTML = '';
        document.head.innerHTML = '';
    });

    it('retries GetCosmeticData until isAppStarted is true, then repairs native CSS', async () => {
        vi.useFakeTimers();
        document.head.innerHTML = '';
        sendAppMessageMock
            .mockResolvedValueOnce(makeCosmeticData({ isAppStarted: false }))
            .mockResolvedValueOnce(makeCosmeticData({ nativeCssSelectors: ['.some-sel'] }));

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

    it('stops retrying after MAX_GET_COSMETIC_DATA_TRIES attempts', async () => {
        vi.useFakeTimers();
        document.head.innerHTML = '';
        sendAppMessageMock.mockResolvedValue(makeCosmeticData({ isAppStarted: false }));

        const cosmeticController = new CosmeticController();
        cosmeticController.init();

        // Advance well beyond 200 retries × 100ms (~20s) — the loop gives up.
        await vi.advanceTimersByTimeAsync(25_000);

        // 1 initial call + 201 retries: tries 0..200 retry, tries 201 falls
        // through and stops.
        expect(sendAppMessageMock).toHaveBeenCalledTimes(202);

        // No style was injected (the engine never became ready).
        expect(document.querySelector('style')).toBeNull();
    });

    it('still repairs invalid native CSS selectors', async () => {
        vi.useFakeTimers();
        document.head.innerHTML = '';
        sendAppMessageMock.mockResolvedValue(makeCosmeticData({
            nativeCssSelectors: ['.some-sel'],
        }));

        const cosmeticController = new CosmeticController();
        cosmeticController.init();
        await vi.advanceTimersByTimeAsync(0);

        const style = document.querySelector('style');
        expect(style).not.toBeNull();
        expect(style?.textContent).toContain('.valid-sel');
    });

    it('does not apply ExtCSS rules even when the response carries them', async () => {
        vi.useFakeTimers();
        document.body.innerHTML = '<div class="ad"><span class="child"></span></div>';
        sendAppMessageMock.mockResolvedValue(makeCosmeticData({
            extCssRules: ['.ad:has(.child) { display: none !important; }'],
        }));

        const cosmeticController = new CosmeticController();
        cosmeticController.init();
        await vi.advanceTimersByTimeAsync(0);

        const ad = document.querySelector('.ad') as HTMLElement;
        expect(getComputedStyle(ad).display).toBe('block');
    });

    it('no longer references ExtendedCss (source guard)', () => {
        // ExtCSS application moved to the background; the shared controller
        // keeps only the native-CSS repair retry loop and the native hits
        // counter lifecycle.
        for (const source of [MV2_CONTROLLER_SRC, SHARED_CONTROLLER_SRC]) {
            expect(source).not.toContain('@adguard/extended-css');
            expect(source).not.toContain('new ExtendedCss');
            expect(source).not.toContain('applyExtendedCss');
            expect(source).not.toContain('beforeStyleApplied');
        }
        // Native CSS hits counting stays in the content script.
        expect(SHARED_CONTROLLER_SRC).toContain('CssHitsCounter');
        // The MV2 controller stays a thin subclass of the shared controller.
        expect(MV2_CONTROLLER_SRC).toContain('extends CosmeticControllerCommon');
    });
});

describe('MV2 CosmeticController — native CssHitsCounter', () => {
    beforeEach(() => {
        mockHitsCounterInstance();
    });

    afterEach(() => {
        vi.useRealTimers();
        vi.restoreAllMocks();
        sendAppMessageMock.mockReset();
        cssHitsCounterCtorSpy.mockClear();
        document.body.innerHTML = '';
        document.head.innerHTML = '';
    });

    it('creates a CssHitsCounter when areHitsStatsCollected is true and the app is started', async () => {
        vi.useFakeTimers();
        document.head.innerHTML = '';
        sendAppMessageMock.mockResolvedValue(makeCosmeticData({
            areHitsStatsCollected: true,
        }));

        const cosmeticController = new CosmeticController();
        cosmeticController.init();
        await vi.advanceTimersByTimeAsync(0);

        expect(cssHitsCounterCtorSpy).toHaveBeenCalledTimes(1);
    });

    it('does NOT create a CssHitsCounter when areHitsStatsCollected is false', async () => {
        vi.useFakeTimers();
        document.head.innerHTML = '';
        sendAppMessageMock.mockResolvedValue(makeCosmeticData());

        const cosmeticController = new CosmeticController();
        cosmeticController.init();
        await vi.advanceTimersByTimeAsync(0);

        expect(cssHitsCounterCtorSpy).not.toHaveBeenCalled();
    });

    it('sends SaveCssHitsStats messages through the counter callback', async () => {
        vi.useFakeTimers();
        document.head.innerHTML = '';
        sendAppMessageMock.mockResolvedValue(makeCosmeticData({
            areHitsStatsCollected: true,
        }));

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

    it('creates exactly one CssHitsCounter when a retry succeeds', async () => {
        vi.useFakeTimers();
        document.head.innerHTML = '';
        sendAppMessageMock
            .mockResolvedValueOnce(makeCosmeticData({
                isAppStarted: false,
                areHitsStatsCollected: true,
            }))
            .mockResolvedValueOnce(makeCosmeticData({
                isAppStarted: true,
                areHitsStatsCollected: true,
            }));

        const cosmeticController = new CosmeticController();
        cosmeticController.init();

        // The not-started response must not create a counter.
        await vi.advanceTimersByTimeAsync(0);
        expect(cssHitsCounterCtorSpy).not.toHaveBeenCalled();

        // The successful retry creates exactly one.
        await vi.advanceTimersByTimeAsync(100);
        expect(cssHitsCounterCtorSpy).toHaveBeenCalledTimes(1);
    });
});
