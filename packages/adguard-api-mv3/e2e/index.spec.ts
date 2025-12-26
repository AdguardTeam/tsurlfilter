import {
    describe,
    it,
    expect,
} from 'vitest';

describe('Adguard API MV3', () => {
    /**
     * We expect the library to be imported in any browser extension context, not just the service worker.
     */
    it('Should not throw error on import outside of service worker', async () => {
        // @ts-expect-error(2307)
        // eslint-disable-next-line import/extensions
        const { AdguardApi } = await import('../dist/adguard-api');
        const adguardApi = await AdguardApi.create();

        expect(adguardApi).toBeDefined();
    });
});
