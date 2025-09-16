import {
    describe,
    beforeAll,
    it,
    expect,
    vi,
} from 'vitest';

describe('Adguard API MV3', () => {
    beforeAll(() => {
        /**
         * Mock part of the chrome web extension API to bypass the error
         * thrown by importing `webextension-polyfill`.
         *
         * In the future, we can dynamically import the polyfill to reduce library side effects
         * and allow it to be imported anywhere.
         */
        Object.defineProperty(global, 'chrome', {
            value: {
                runtime: {
                    id: 'test',
                    getManifest: vi.fn(() => ({ manifest_version: 3 })),
                },
                storage: {
                    // mock a dummy session storage API for tswebextension
                    session: {
                        get: vi.fn(async () => Promise.resolve({})),
                        set: vi.fn(async () => Promise.resolve()),
                    },
                },
            },
        });
    });

    /**
     * We expect the library to be imported in any browser extension context, not just the service worker.
     */
    it('Should not throw error on import outside of service worker', async () => {
        // eslint-disable-next-line import/extensions
        const { AdguardApi } = await import('../dist/adguard-api');
        const adguardApi = await AdguardApi.create();

        expect(adguardApi).toBeDefined();
    });
});
