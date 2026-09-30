import {
    beforeEach,
    describe,
    expect,
    it,
    vi,
} from 'vitest';
import polyfillBrowser from 'webextension-polyfill';

import {
    clearCookieStoreScopeCache,
    isExtensionContextIncognito,
    resolveCookieStoreScope,
} from '../../../../src/lib/common/cookie-filtering/cookie-store-scope';

vi.mock('../../../../src/lib/common/utils/logger');

type TestCookieStore = { id: string; tabIds: number[] };
type TestTab = { incognito: boolean };

describe('resolveCookieStoreScope', () => {
    let getAllCookieStores: ReturnType<typeof vi.fn<() => Promise<TestCookieStore[]>>>;
    let getTab: ReturnType<typeof vi.fn<(tabId: number) => Promise<TestTab>>>;
    let isTabIncognito: ReturnType<typeof vi.fn<(tabId: number) => boolean | undefined>>;

    beforeEach(() => {
        clearCookieStoreScopeCache();

        getAllCookieStores = vi.fn(async (): Promise<TestCookieStore[]> => []);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (polyfillBrowser as any).cookies = { getAllCookieStores };

        getTab = vi.fn(async (): Promise<TestTab> => ({ incognito: false }));
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (polyfillBrowser as any).tabs = {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            ...(polyfillBrowser as any).tabs,
            get: getTab,
        };

        isTabIncognito = vi.fn(() => false);
    });

    describe('Firefox', () => {
        it('returns the reported cookie store id', async () => {
            const scope = await resolveCookieStoreScope(
                { cookieStoreId: 'firefox-container-3' },
                true,
                isTabIncognito,
                false,
            );

            expect(scope).toEqual({ storeId: 'firefox-container-3' });
        });

        it('returns the default store scope when no store info is present', async () => {
            const scope = await resolveCookieStoreScope({}, true, isTabIncognito, false);

            expect(scope).toEqual({});
        });

        it('returns null for a private request without cookie store id', async () => {
            const scope = await resolveCookieStoreScope(
                { incognito: true },
                true,
                isTabIncognito,
                false,
            );

            expect(scope).toBeNull();
        });

        it('never consults the tab incognito state', async () => {
            await resolveCookieStoreScope(
                { cookieStoreId: 'firefox-default', tabId: 1 },
                true,
                isTabIncognito,
                true,
            );

            expect(isTabIncognito).not.toHaveBeenCalled();
            expect(getAllCookieStores).not.toHaveBeenCalled();
        });
    });

    describe('Chromium split mode', () => {
        it('returns the default store scope, the context store is already incognito', async () => {
            const scope = await resolveCookieStoreScope(
                { tabId: 1 },
                false,
                isTabIncognito,
                true,
            );

            expect(scope).toEqual({});
            expect(isTabIncognito).not.toHaveBeenCalled();
            expect(getAllCookieStores).not.toHaveBeenCalled();
        });
    });

    describe('Chromium spanning mode', () => {
        it('returns the default store scope for requests not related to a tab', async () => {
            const scope = await resolveCookieStoreScope(
                { tabId: -1 },
                false,
                isTabIncognito,
                false,
            );

            expect(scope).toEqual({});
            expect(isTabIncognito).not.toHaveBeenCalled();
            expect(getTab).not.toHaveBeenCalled();
        });

        it('returns the default store scope for requests without a tab id', async () => {
            const scope = await resolveCookieStoreScope({}, false, isTabIncognito, false);

            expect(scope).toEqual({});
            expect(isTabIncognito).not.toHaveBeenCalled();
            expect(getTab).not.toHaveBeenCalled();
        });

        it('returns the default store scope for regular tabs', async () => {
            isTabIncognito.mockReturnValue(false);

            const scope = await resolveCookieStoreScope(
                { tabId: 1 },
                false,
                isTabIncognito,
                false,
            );

            expect(scope).toEqual({});
            expect(getAllCookieStores).not.toHaveBeenCalled();
            expect(getTab).not.toHaveBeenCalled();
        });

        it('resolves the incognito cookie store from the originating tab', async () => {
            isTabIncognito.mockReturnValue(true);
            getAllCookieStores.mockResolvedValue([
                { id: '0', tabIds: [1, 2] },
                { id: '1', tabIds: [3] },
            ]);

            const scope = await resolveCookieStoreScope(
                { tabId: 3 },
                false,
                isTabIncognito,
                false,
            );

            expect(scope).toEqual({ storeId: '1' });
            expect(getTab).not.toHaveBeenCalled();
        });

        it('returns null for a private tab whose store cannot be resolved', async () => {
            isTabIncognito.mockReturnValue(true);
            getAllCookieStores.mockResolvedValue([{ id: '0', tabIds: [1, 2] }]);

            const scope = await resolveCookieStoreScope(
                { tabId: 3 },
                false,
                isTabIncognito,
                false,
            );

            expect(scope).toBeNull();
            // Initial lookup plus one refresh of the possibly stale cache.
            expect(getAllCookieStores).toHaveBeenCalledTimes(2);
        });

        it('refreshes a stale store list when the tab is not in it', async () => {
            isTabIncognito.mockReturnValue(true);
            getAllCookieStores
                .mockResolvedValueOnce([{ id: '0', tabIds: [1] }])
                .mockResolvedValueOnce([
                    { id: '0', tabIds: [1] },
                    { id: '1', tabIds: [3] },
                ]);

            const scope = await resolveCookieStoreScope(
                { tabId: 3 },
                false,
                isTabIncognito,
                false,
            );

            expect(scope).toEqual({ storeId: '1' });
            expect(getAllCookieStores).toHaveBeenCalledTimes(2);
        });

        it('reuses the cached store list for subsequent lookups', async () => {
            isTabIncognito.mockReturnValue(true);
            getAllCookieStores.mockResolvedValue([
                { id: '0', tabIds: [1] },
                { id: '1', tabIds: [3, 4] },
            ]);

            await resolveCookieStoreScope({ tabId: 3 }, false, isTabIncognito, false);
            await resolveCookieStoreScope({ tabId: 4 }, false, isTabIncognito, false);

            expect(getAllCookieStores).toHaveBeenCalledTimes(1);
        });

        it('asks the browser for the tab state when it is unknown and resolves the private store', async () => {
            isTabIncognito.mockReturnValue(undefined);
            getTab.mockResolvedValue({ incognito: true });
            getAllCookieStores.mockResolvedValue([
                { id: '0', tabIds: [1] },
                { id: '1', tabIds: [3] },
            ]);

            const scope = await resolveCookieStoreScope(
                { tabId: 3 },
                false,
                isTabIncognito,
                false,
            );

            expect(getTab).toHaveBeenCalledWith(3);
            expect(scope).toEqual({ storeId: '1' });
        });

        it('returns the default store scope when the browser reports a regular unknown tab', async () => {
            isTabIncognito.mockReturnValue(undefined);
            getTab.mockResolvedValue({ incognito: false });

            const scope = await resolveCookieStoreScope(
                { tabId: 3 },
                false,
                isTabIncognito,
                false,
            );

            expect(getTab).toHaveBeenCalledWith(3);
            expect(scope).toEqual({});
            expect(getAllCookieStores).not.toHaveBeenCalled();
        });

        it('skips the jar when the browser cannot report the tab state', async () => {
            isTabIncognito.mockReturnValue(undefined);
            getTab.mockRejectedValue(new Error('No tab with id: 3'));

            const scope = await resolveCookieStoreScope(
                { tabId: 3 },
                false,
                isTabIncognito,
                false,
            );

            expect(getTab).toHaveBeenCalledWith(3);
            expect(scope).toBeNull();
            expect(getAllCookieStores).not.toHaveBeenCalled();
        });

        it('skips the jar when the cookie store list cannot be retrieved', async () => {
            isTabIncognito.mockReturnValue(true);
            getAllCookieStores.mockRejectedValue(new Error('cannot get cookie stores'));

            const scope = await resolveCookieStoreScope(
                { tabId: 3 },
                false,
                isTabIncognito,
                false,
            );

            expect(scope).toBeNull();
        });
    });
});

describe('isExtensionContextIncognito', () => {
    it('reflects the polyfill inIncognitoContext flag', () => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const browser = polyfillBrowser as any;

        browser.extension = { inIncognitoContext: true };
        expect(isExtensionContextIncognito()).toBe(true);

        browser.extension = { inIncognitoContext: false };
        expect(isExtensionContextIncognito()).toBe(false);

        browser.extension = undefined;
        expect(isExtensionContextIncognito()).toBe(false);
    });
});
