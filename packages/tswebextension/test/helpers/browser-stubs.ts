import polyfillBrowser from 'webextension-polyfill';

/**
 * Cookie store shape returned by the `browser.cookies.getAllCookieStores`
 * stub.
 */
export type TestCookieStore = { id: string; tabIds: number[] };

/**
 * Tab shape returned by the `browser.tabs.get` stub.
 */
export type TestTab = { incognito: boolean };

/**
 * Original polyfill namespaces, captured before the tests replace them, so
 * {@link restoreBrowserStubs} can undo the replacement.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const originalCookies = (polyfillBrowser as any).cookies;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const originalTabs = (polyfillBrowser as any).tabs;

/**
 * Replaces the polyfill `cookies` namespace with a test stub.
 *
 * @param cookies Stub for `browser.cookies`.
 */
export const stubBrowserCookies = (cookies: unknown): void => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (polyfillBrowser as any).cookies = cookies;
};

/**
 * Replaces `browser.tabs.get` with a test stub, keeping the rest of the
 * namespace.
 *
 * @param getTab Stub for `browser.tabs.get`.
 */
export const stubBrowserTabsGet = (getTab: (tabId: number) => Promise<TestTab>): void => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (polyfillBrowser as any).tabs = {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        ...(polyfillBrowser as any).tabs,
        get: getTab,
    };
};

/**
 * Restores the polyfill namespaces captured at import time. Call it from
 * `afterAll` so the stubs do not leak into other tests in the same file.
 */
export const restoreBrowserStubs = (): void => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (polyfillBrowser as any).cookies = originalCookies;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (polyfillBrowser as any).tabs = originalTabs;
};
