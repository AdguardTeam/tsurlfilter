import {
    beforeEach,
    describe,
    expect,
    it,
    vi,
} from 'vitest';
import polyfillBrowser from 'webextension-polyfill';

import {
    HTTPMethod,
    MatchingResult,
    type NetworkRule,
    RequestType,
} from '@adguard/tsurlfilter';

import { clearCookieStoreScopeCache } from '../../../../../../src/lib/common/cookie-filtering/cookie-store-scope';
import { ContentType } from '../../../../../../src/lib/common/request-type';
import {
    type RequestContext,
    RequestContextState,
    requestContextStorage,
} from '../../../../../../src/lib/mv3/background/request';
import { CookieFiltering } from '../../../../../../src/lib/mv3/background/services/cookie-filtering/cookie-filtering';
import { tabsApi } from '../../../../../../src/lib/mv3/tabs/tabs-api';
import { createNetworkRule } from '../../../../../helpers/rule-creator';

const { detectorState } = vi.hoisted((): { detectorState: { isFirefox: boolean } } => ({
    detectorState: { isFirefox: true },
}));

vi.mock('../../../../../../src/lib/common/utils/logger');
vi.mock('../../../../../../src/lib/mv3/background/engine-api', () => ({
    engineApi: {},
}));
vi.mock('../../../../../../src/lib/mv3/utils/browser-detector', (): {
    browserDetectorMV3: { isFirefox: () => boolean };
} => ({
    browserDetectorMV3: {
        isFirefox: (): boolean => detectorState.isFirefox,
    },
}));
vi.mock('../../../../../../src/lib/mv3/tabs/tabs-api', () => ({
    tabsApi: {
        getTabIncognitoState: vi.fn(() => false),
        getTabContext: vi.fn(),
    },
}));
vi.mock('../../../../../../src/lib/common/filtering-log', async (importOriginal) => {
    const actual = await importOriginal() as Record<string, unknown>;
    return {
        ...actual,
        defaultFilteringLog: { publishEvent: vi.fn() },
    };
});
vi.mock('../../../../../../src/lib/common/utils/rule-text-provider', () => ({
    getRuleTexts: vi.fn(() => ({ appliedRuleText: 'rule-text', originalRuleText: null })),
}));

type TestCookieStore = { id: string; tabIds: number[] };
type TestTab = { incognito: boolean };

/**
 * Stub for `browser.cookies.*` capturing the details of every jar call,
 * so we can assert the resolved cookie store scope is passed through.
 */
const cookiesStub = {
    remove: vi.fn(async () => undefined),
    set: vi.fn(async () => ({ name: '', value: '' })),
    getAll: vi.fn(async () => []),
    getAllCookieStores: vi.fn(async (): Promise<TestCookieStore[]> => []),
};

/**
 * Stub for `browser.tabs.get`, used by the resolver when the in-memory tab
 * state is unknown.
 */
const tabsGetStub = vi.fn(async (): Promise<TestTab> => ({ incognito: false }));

// eslint-disable-next-line @typescript-eslint/no-explicit-any
(polyfillBrowser as any).cookies = cookiesStub;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
(polyfillBrowser as any).tabs = {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ...(polyfillBrowser as any).tabs,
    get: tabsGetStub,
};

const getTabIncognitoStateMock = vi.mocked(tabsApi.getTabIncognitoState);

describe('CookieFiltering cookie store scope, MV3 (AG-55093)', () => {
    let cookieFiltering: CookieFiltering;
    let context: RequestContext;

    const requestId = '1';
    const requestUrl = 'https://example.org';

    beforeEach(() => {
        vi.clearAllMocks();
        clearCookieStoreScopeCache();
        detectorState.isFirefox = true;
        tabsGetStub.mockResolvedValue({ incognito: false });
        getTabIncognitoStateMock.mockReset().mockReturnValue(false);

        cookieFiltering = new CookieFiltering();

        context = {
            eventId: '1',
            state: RequestContextState.BeforeSendHeaders,
            requestId,
            requestUrl,
            referrerUrl: requestUrl,
            requestType: RequestType.Document,
            contentType: ContentType.Document,
            tabId: 0,
            frameId: 0,
            timestamp: Date.now(),
            thirdParty: false,
            matchingResult: new MatchingResult([], null),
            method: HTTPMethod.GET,
        };
    });

    const setupCase = (
        rules: NetworkRule[],
        contextExtra: Partial<RequestContext>,
    ): void => {
        Object.assign(context, contextExtra);
        context.matchingResult = new MatchingResult(rules, null);
        requestContextStorage.set(requestId, context);
    };

    /**
     * Waits for the fire-and-forget `applyRules` promise chain to settle.
     */
    const flushAsync = async (): Promise<void> => {
        await new Promise((resolve) => {
            setTimeout(resolve, 0);
        });
    };

    const runRequestCase = async (
        rules: NetworkRule[],
        cookieHeaderValue: string,
        contextExtra: Partial<RequestContext> = {},
    ): Promise<void> => {
        setupCase(rules, contextExtra);
        context.requestHeaders = [
            { name: 'Cookie', value: cookieHeaderValue },
        ];

        cookieFiltering.onBeforeSendHeaders(context);

        await flushAsync();
        requestContextStorage.delete(requestId);
    };

    const runResponseCase = async (
        rules: NetworkRule[],
        setCookieHeaderValue: string,
        contextExtra: Partial<RequestContext> = {},
    ): Promise<void> => {
        setupCase(rules, contextExtra);
        context.responseHeaders = [
            { name: 'set-cookie', value: setCookieHeaderValue },
        ];

        cookieFiltering.onHeadersReceived(context);

        await flushAsync();
        requestContextStorage.delete(requestId);
    };

    it('Firefox: passes request cookieStoreId to cookies.remove (private/container jar)', async () => {
        const cookieRule = createNetworkRule('||example.org^$cookie=c_user', 1);

        await runRequestCase(
            [cookieRule],
            'c_user=test_value',
            { cookieStoreId: 'firefox-container-3' },
        );

        expect(cookiesStub.remove).toHaveBeenCalledTimes(1);
        expect(cookiesStub.remove).toHaveBeenCalledWith(expect.objectContaining({
            name: 'c_user',
            storeId: 'firefox-container-3',
        }));
    });

    it('Firefox: passes request cookieStoreId to cookies.getAll and cookies.set for modifying rules', async () => {
        const cookieRule = createNetworkRule('||example.org^$cookie=pick;maxAge=3600', 1);

        await runResponseCase(
            [cookieRule],
            'pick=secret_value',
            { cookieStoreId: 'firefox-private-window-1' },
        );

        expect(cookiesStub.getAll).toHaveBeenCalledWith(expect.objectContaining({
            name: 'pick',
            storeId: 'firefox-private-window-1',
        }));
        expect(cookiesStub.set).toHaveBeenCalledTimes(1);
        expect(cookiesStub.set).toHaveBeenCalledWith(expect.objectContaining({
            name: 'pick',
            value: 'secret_value',
            storeId: 'firefox-private-window-1',
        }));
    });

    it('Firefox: does not touch the jar for an incognito request without cookieStoreId', async () => {
        const cookieRule = createNetworkRule('||example.org^$cookie=c_user', 1);

        await runRequestCase(
            [cookieRule],
            'c_user=test_value',
            { incognito: true },
        );

        expect(cookiesStub.remove).not.toHaveBeenCalled();
        expect(cookiesStub.set).not.toHaveBeenCalled();
    });

    it('Chromium spanning: resolves the incognito cookie store from the originating tab', async () => {
        const cookieRule = createNetworkRule('||example.org^$cookie=c_user', 1);
        detectorState.isFirefox = false;

        getTabIncognitoStateMock.mockImplementation((tabId) => tabId === 5);
        cookiesStub.getAllCookieStores.mockResolvedValue([
            { id: '0', tabIds: [1] },
            { id: '1', tabIds: [5] },
        ]);

        await runRequestCase(
            [cookieRule],
            'c_user=test_value',
            { tabId: 5 },
        );

        expect(cookiesStub.remove).toHaveBeenCalledTimes(1);
        expect(cookiesStub.remove).toHaveBeenCalledWith(expect.objectContaining({
            name: 'c_user',
            storeId: '1',
        }));
    });

    it('Chromium spanning: passes incognito storeId to cookies.getAll/set for modifying rules', async () => {
        const cookieRule = createNetworkRule('||example.org^$cookie=pick;maxAge=3600', 1);
        detectorState.isFirefox = false;

        getTabIncognitoStateMock.mockImplementation((tabId) => tabId === 5);
        cookiesStub.getAllCookieStores.mockResolvedValue([
            { id: '0', tabIds: [1] },
            { id: '1', tabIds: [5] },
        ]);

        await runResponseCase(
            [cookieRule],
            'pick=secret_value',
            { tabId: 5 },
        );

        expect(cookiesStub.getAll).toHaveBeenCalledWith(expect.objectContaining({
            name: 'pick',
            storeId: '1',
        }));
        expect(cookiesStub.set).toHaveBeenCalledTimes(1);
        expect(cookiesStub.set).toHaveBeenCalledWith(expect.objectContaining({
            name: 'pick',
            value: 'secret_value',
            storeId: '1',
        }));
    });

    it('Chromium spanning: resolves incognito store via tabs.get when the tab state is unknown', async () => {
        const cookieRule = createNetworkRule('||example.org^$cookie=c_user', 1);
        detectorState.isFirefox = false;

        getTabIncognitoStateMock.mockReturnValue(undefined);
        tabsGetStub.mockResolvedValue({ incognito: true });
        cookiesStub.getAllCookieStores.mockResolvedValue([
            { id: '0', tabIds: [1] },
            { id: '1', tabIds: [5] },
        ]);

        await runRequestCase(
            [cookieRule],
            'c_user=test_value',
            { tabId: 5 },
        );

        expect(tabsGetStub).toHaveBeenCalledWith(5);
        expect(cookiesStub.remove).toHaveBeenCalledTimes(1);
        expect(cookiesStub.remove).toHaveBeenCalledWith(expect.objectContaining({
            name: 'c_user',
            storeId: '1',
        }));
    });

    it('Chromium spanning: does not touch the jar when the tab state cannot be determined', async () => {
        const cookieRule = createNetworkRule('||example.org^$cookie=c_user', 1);
        detectorState.isFirefox = false;

        getTabIncognitoStateMock.mockReturnValue(undefined);
        tabsGetStub.mockRejectedValue(new Error('No tab with id: 5'));

        await runRequestCase(
            [cookieRule],
            'c_user=test_value',
            { tabId: 5 },
        );

        expect(tabsGetStub).toHaveBeenCalledWith(5);
        expect(cookiesStub.remove).not.toHaveBeenCalled();
        expect(cookiesStub.set).not.toHaveBeenCalled();
    });

    it('Chromium: regular requests operate on the default jar without extra fields', async () => {
        const cookieRule = createNetworkRule('||example.org^$cookie=c_user', 1);
        detectorState.isFirefox = false;

        await runRequestCase(
            [cookieRule],
            'c_user=test_value',
        );

        expect(cookiesStub.remove).toHaveBeenCalledTimes(1);
        expect(cookiesStub.remove).toHaveBeenCalledWith({
            name: 'c_user',
            url: requestUrl,
        });
    });
});
