import browser from 'webextension-polyfill';

import { logger } from '../utils/logger';

import Cookies = browser.Cookies;

/**
 * Cookie store scope. Determines which cookie store a `browser.cookies.*`
 * API call operates on.
 *
 * Without an explicit scope, both Firefox and Chromium resolve the call to
 * the cookie store of the current execution context. For a background script
 * running in the regular profile — Firefox always, Chromium in the default
 * "spanning" incognito mode — that is the regular (non-private) cookie store,
 * so cookies observed in a private browsing session are written to the normal
 * window's jar, which leaks private sessions
 * {@link https://github.com/AdguardTeam/AdguardBrowserExtension/issues/3553}.
 */
export interface CookieStoreScope {
    /**
     * Cookie store id: on Firefox `firefox-default`, a private window store,
     * or a Multi-Account Containers store id; on Chromium the incognito
     * cookie store id resolved via `browser.cookies.getAllCookieStores()`.
     */
    storeId?: string;
}

/**
 * Minimal request information required to resolve the cookie store scope.
 * Mirrors the Firefox/Chromium webRequest details fields.
 */
export interface CookieStoreRequestInfo {
    /**
     * Firefox webRequest details: the cookie store id of the contextual
     * identity the request originated from.
     */
    cookieStoreId?: string;

    /**
     * Firefox webRequest details: `true` for requests originating from a
     * private browsing window.
     */
    incognito?: boolean;

    /**
     * Id of the tab the request belongs to. Used on Chromium, where
     * webRequest details carry no private-browsing signal, to derive the
     * private state of the request from the tab.
     */
    tabId?: number;
}

/**
 * Checks whether the extension itself runs in an off-the-record context,
 * i.e. a Chromium split-mode incognito background page/service worker.
 *
 * @returns True if the current extension context is private.
 */
export const isExtensionContextIncognito = (): boolean => {
    return browser.extension?.inIncognitoContext === true;
};

/**
 * Cached cookie store list for Chromium spanning mode.
 *
 * A cached list is only trusted when it contains the requested tab id: tab
 * ids are unique within a browser session and a tab cannot migrate between
 * cookie stores, so a cache hit is always authoritative. A miss forces a
 * single refresh, which covers incognito windows opened or closed since the
 * list was cached.
 */
let cookieStoresCache: Cookies.CookieStore[] | null = null;

/**
 * Clears the cached cookie store list. Primarily intended for tests.
 */
export const clearCookieStoreScopeCache = (): void => {
    cookieStoresCache = null;
};

/**
 * Returns the browser's cookie stores, using the cached list when available.
 *
 * @returns List of cookie stores.
 */
const getCookieStores = async (): Promise<Cookies.CookieStore[]> => {
    if (cookieStoresCache === null) {
        cookieStoresCache = await browser.cookies.getAllCookieStores();
    }

    return cookieStoresCache;
};

/**
 * Resolves the id of the cookie store the given tab belongs to.
 *
 * @param tabId Tab id.
 *
 * @returns Cookie store id, or `null` when the store of the tab cannot be
 * determined.
 */
const findCookieStoreIdForTab = async (tabId: number): Promise<string | null> => {
    const findStore = (stores: Cookies.CookieStore[]): Cookies.CookieStore | undefined => {
        return stores.find((store) => store.tabIds.includes(tabId));
    };

    try {
        let store = findStore(await getCookieStores());

        if (!store) {
            // The cached store list may be stale (an incognito window has been
            // opened or closed since it was cached), refresh it once before
            // giving up.
            cookieStoresCache = null;
            store = findStore(await getCookieStores());
        }

        return store?.id ?? null;
    } catch (e) {
        logger.debug('[tsweb.cookie-store-scope]: cannot get cookie stores: ', e);

        return null;
    }
};

/**
 * Resolves the private-browsing state of a tab for Chromium, falling back to
 * the browser when the in-memory tab context is missing or synthetic.
 *
 * A missing or synthetic tab context must not be treated as a regular tab:
 * `TabsApi` defaults `incognito` to `false` for synthetic contexts, and MV3
 * starts request processing before open tabs are tracked, so requests from a
 * private tab can arrive before the tab state is known.
 *
 * @param tabId Tab id.
 * @param isTabIncognito Lookup reporting whether the given tab is private,
 * or `undefined` when the state is unknown.
 *
 * @returns `true`/`false` when the state is known, `null` when it could not
 * be determined.
 */
const resolveTabIncognitoState = async (
    tabId: number,
    isTabIncognito: (tabId: number) => boolean | undefined,
): Promise<boolean | null> => {
    const state = isTabIncognito(tabId);

    if (state !== undefined) {
        return state;
    }

    // The tab context is missing or synthetic (e.g. `tabs.onCreated` has not
    // fired yet, Edge split screen, or MV3 startup before open tabs are
    // processed). Ask the browser directly so a private tab is not
    // mistakenly treated as a regular one.
    try {
        const tab = await browser.tabs.get(tabId);

        return tab.incognito;
    } catch (e) {
        logger.debug('[tsweb.cookie-store-scope]: cannot determine tab incognito state: ', e);

        return null;
    }
};

/**
 * Resolves the cookie store scope for a webRequest-driven cookie operation.
 *
 * Residual limitations, all deliberately conservative:
 * - Chromium spanning mode: requests not tied to a tab (e.g. service worker
 *   requests) carry no private-browsing signal in webRequest details, so the
 *   cookie jar is left untouched;
 * - Chromium spanning mode: if the tab state cannot be determined even by the
 *   browser (`tabs.get` fails), or the store list cannot be retrieved, the
 *   cookie jar is left untouched — a private request must not fall back to
 *   the regular store;
 * - Firefox: a private request without `cookieStoreId` yields `null`, so the
 *   cookie jar is left untouched.
 *
 * @param request Request info with Firefox/Chromium webRequest details fields.
 * @param isFirefox Whether the current browser is Firefox.
 * @param isTabIncognito Lookup reporting whether the given tab is private
 * (Chromium spanning mode carries no private-browsing signal in webRequest
 * details, so it is derived from the tab), or `undefined` when the state is
 * unknown.
 * @param contextIncognito Whether the extension context itself is incognito.
 * Defaults to {@link isExtensionContextIncognito}, injectable for tests.
 *
 * @returns The scope to attach to `browser.cookies.*` call details, or `null`
 * when the request may be private but its target store cannot be determined.
 * A `null` scope must be treated by callers as "do not touch the cookie jar":
 * falling back to the default store would leak private-session cookies into
 * it.
 */
export const resolveCookieStoreScope = async (
    request: CookieStoreRequestInfo,
    isFirefox: boolean,
    isTabIncognito: (tabId: number) => boolean | undefined,
    contextIncognito: boolean = isExtensionContextIncognito(),
): Promise<CookieStoreScope | null> => {
    if (isFirefox) {
        if (request.cookieStoreId !== undefined) {
            // Covers the default jar, private windows and containers.
            return { storeId: request.cookieStoreId };
        }

        // Firefox should always report cookieStoreId for tab-related requests.
        // If a private request arrives without store info, we cannot address
        // its jar safely.
        if (request.incognito) {
            return null;
        }

        return {};
    }

    // Chromium split mode: private requests are served by a separate
    // off-the-record extension context whose default cookie store is already
    // the incognito one, so no explicit scope is needed there.
    if (contextIncognito) {
        return {};
    }

    // Chromium spanning mode: requests not related to a tab (e.g. service
    // worker requests) carry no private-browsing signal in webRequest details,
    // so the target store cannot be determined — skip the jar instead of
    // writing a private-session cookie into the regular store.
    const { tabId } = request;
    if (tabId === undefined || tabId < 0) {
        return null;
    }

    const isTabPrivate = await resolveTabIncognitoState(tabId, isTabIncognito);

    if (isTabPrivate === null) {
        // The tab state could not be determined (e.g. the tab was closed
        // while the request was in flight). Skip the jar: the request may
        // originate from a private tab, and the default store would leak its
        // cookies into the regular one.
        return null;
    }

    if (!isTabPrivate) {
        // Regular tab: the default store is the correct target.
        return {};
    }

    // The request originates from a private tab: address the incognito
    // cookie store explicitly, or skip jar mutations when it cannot be
    // resolved.
    const storeId = await findCookieStoreIdForTab(tabId);

    return storeId === null ? null : { storeId };
};
