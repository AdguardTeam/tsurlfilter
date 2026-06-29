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

describe('MV3 CosmeticController — ExtCSS removed', () => {
    afterEach(() => {
        vi.useRealTimers();
        vi.restoreAllMocks();
    });

    it('does not retry GetCosmeticData when isAppStarted is false', async () => {
        vi.useFakeTimers();
        document.head.innerHTML = '';
        sendAppMessageMock.mockResolvedValue({
            isAppStarted: false,
            areHitsStatsCollected: false,
            extCssRules: ['.ad { display: none !important; }'],
            nativeCssSelectors: null,
        });

        CosmeticController.init();

        await vi.advanceTimersByTimeAsync(0);
        // Advance well past the legacy 100ms retry interval.
        await vi.advanceTimersByTimeAsync(1000);

        expect(sendAppMessageMock).toHaveBeenCalledTimes(1);
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

    it('no longer references ExtendedCss or the retry constants (source guard)', () => {
        expect(CONTROLLER_SRC).not.toContain('@adguard/extended-css');
        expect(CONTROLLER_SRC).not.toContain('ExtendedCss');
        expect(CONTROLLER_SRC).not.toContain('applyExtendedCss');
        expect(CONTROLLER_SRC).not.toContain('MAX_GET_COSMETIC_DATA_TRIES');
        expect(CONTROLLER_SRC).not.toContain('GET_COSMETIC_DATA_RETRY_TIMEOUT_MS');
        expect(CONTROLLER_SRC).not.toContain('CssHitsCounter');
        expect(CONTROLLER_SRC).not.toContain('cssHitsCounter');
        expect(CONTROLLER_SRC).not.toContain('beforeStyleApplied');
    });
});
