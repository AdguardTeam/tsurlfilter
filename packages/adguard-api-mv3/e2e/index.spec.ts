import {
    describe,
    expect,
    it,
} from 'vitest';

/**
 * Importing the built bundle with tswebextension in jsdom takes a few seconds
 * and can exceed the default 5 s timeout on busy CI runners.
 */
const IMPORT_TIMEOUT_MS = 15_000;

describe('Adguard API MV3', () => {
    /**
     * We expect the library to be imported in any browser extension context, not just the service worker.
     */
    it('Should not throw error on import outside of service worker', async () => {
        // eslint-disable-next-line import/extensions
        const { AdguardApi } = await import('@adguard/api-mv3');
        const adguardApi = await AdguardApi.create();

        expect(adguardApi).toBeDefined();
    }, IMPORT_TIMEOUT_MS);
});
