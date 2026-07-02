import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
    afterEach,
    describe,
    expect,
    it,
    vi,
} from 'vitest';

import { CosmeticController } from '../../../../src/lib/mv3/content-script/cosmetic-controller';

const { sendAppMessageMock } = vi.hoisted(() => ({
    sendAppMessageMock: vi.fn(),
}));
vi.mock('../../../../src/lib/common/content-script/send-app-message', () => ({
    sendAppMessage: sendAppMessageMock,
}));

vi.mock('../../../../src/lib/common/utils/selector-validator', () => ({
    validateSelectors: vi.fn(() => ({
        valid: ['.valid-sel'],
        invalid: ['.invalid-sel'],
    })),
}));

// Resolve the controller source path relative to THIS test file's directory.
// `readFileSync` resolves relative paths against `process.cwd()` (the package
// root under `pnpm test:mv3`), and `new URL(rel, import.meta.url)` is unreliable
// here because the jsdom test environment makes the URL constructor resolve to
// `http://localhost:3000/...`. Converting `import.meta.url` to a real path and
// joining with `node:path` is robust regardless of the working directory.
const CONTROLLER_PATH = path.resolve(
    path.dirname(fileURLToPath(import.meta.url)),
    '../../../../src/lib/mv3/content-script/cosmetic-controller.ts',
);
const CONTROLLER_SRC = readFileSync(CONTROLLER_PATH, 'utf8');

describe('MV3 CosmeticController — native CSS repair', () => {
    afterEach(() => {
        vi.useRealTimers();
        vi.restoreAllMocks();
        // The static retry counter persists across tests (module-level state);
        // reset it so retry assertions are independent.
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (CosmeticController as any).tries = 0;
        sendAppMessageMock.mockReset();
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

        CosmeticController.init();

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

        CosmeticController.init();

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

        CosmeticController.init();

        // Advance well beyond 200 retries × 100ms (~20s) — the loop gives up.
        await vi.advanceTimersByTimeAsync(25_000);

        // 1 initial call + retries while tries <= MAX_GET_COSMETIC_DATA_TRIES
        // (200): tries 0..200 retry, tries 201 falls through and stops.
        expect(sendAppMessageMock).toHaveBeenCalledTimes(202);

        // No style was injected (the engine never became ready).
        expect(document.querySelector('style')).toBeNull();
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

        CosmeticController.init();
        await vi.advanceTimersByTimeAsync(0);

        const style = document.querySelector('style');
        expect(style).not.toBeNull();
        expect(style?.textContent).toContain('.valid-sel');
    });

    it('no longer references ExtendedCss or CssHitsCounter (source guard)', () => {
        // ExtCSS application moved to the background; only the native-CSS repair
        // retry loop remains in the content script.
        expect(CONTROLLER_SRC).not.toContain('@adguard/extended-css');
        expect(CONTROLLER_SRC).not.toContain('ExtendedCss');
        expect(CONTROLLER_SRC).not.toContain('applyExtendedCss');
        expect(CONTROLLER_SRC).not.toContain('CssHitsCounter');
        expect(CONTROLLER_SRC).not.toContain('cssHitsCounter');
        expect(CONTROLLER_SRC).not.toContain('beforeStyleApplied');
        // The retry constants ARE present again (re-added for the native-CSS
        // repair startup race), so they are asserted to be present rather than
        // absent.
        expect(CONTROLLER_SRC).toContain('GET_COSMETIC_DATA_RETRY_TIMEOUT_MS');
        expect(CONTROLLER_SRC).toContain('MAX_GET_COSMETIC_DATA_TRIES');
    });
});
