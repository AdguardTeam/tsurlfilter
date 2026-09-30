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

import {
    engineApi,
    type RequestContext,
    RequestContextState,
    requestContextStorage,
    tabsApi,
} from '../../../../../../src/lib';
import { clearCookieStoreScopeCache } from '../../../../../../src/lib/common/cookie-filtering/cookie-store-scope';
import { ContentType } from '../../../../../../src/lib/common/request-type';
import { CookieFiltering } from '../../../../../../src/lib/mv2/background/services/cookie-filtering/cookie-filtering';
import { createNetworkRule } from '../../../../../helpers/rule-creator';
import { MockFilteringLog } from '../../../../common/mocks/mock-filtering-log';

const { detectorState } = vi.hoisted((): { detectorState: { isFirefox: boolean } } => ({
    detectorState: { isFirefox: true },
}));

vi.mock('../../../../../../src/lib/common/utils/logger');
vi.mock('../../../../../../src/lib/mv2/background/engine-api');
vi.mock('../../../../../../src/lib/mv2/background/utils/browser-detector', (): {
    browserDetectorMV2: { isFirefox: () => boolean };
} => ({
    browserDetectorMV2: {
        isFirefox: (): boolean => detectorState.isFirefox,
    },
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

describe('CookieFiltering cookie store scope (AG-55093)', () => {
    let cookieFiltering: CookieFiltering;
    let mockFilteringLog: MockFilteringLog;
    let context: RequestContext;
    let getTabIncognitoStateSpy: ReturnType<typeof vi.spyOn>;

    const requestId = '1';
    const requestUrl = 'https://example.org';

    beforeEach(() => {
        vi.clearAllMocks();
        clearCookieStoreScopeCache();
        detectorState.isFirefox = true;

        tabsGetStub.mockResolvedValue({ incognito: false });

        getTabIncognitoStateSpy = vi
            .spyOn(tabsApi, 'getTabIncognitoState')
            .mockReset()
            .mockReturnValue(false);

        mockFilteringLog = new MockFilteringLog();
        cookieFiltering = new CookieFiltering(mockFilteringLog, engineApi, tabsApi);

        context = {
            eventId: '1',
            state: RequestContextState.HeadersReceived,
            requestId,
            requestUrl,
            referrerUrl: requestUrl,
            requestType: RequestType.Document,
            contentType: ContentType.Document,
            statusCode: 200,
            tabId: 0,
            frameId: 0,
            requestFrameId: 0,
            timestamp: Date.now(),
            thirdParty: false,
            matchingResult: new MatchingResult([], null),
            cookies: undefined,
            contentTypeHeader: undefined,
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
            { cookieStoreId: 'firefox-private' },
        );

        expect(cookiesStub.getAll).toHaveBeenCalledWith(expect.objectContaining({
            name: 'pick',
            storeId: 'firefox-private',
        }));
        expect(cookiesStub.set).toHaveBeenCalledTimes(1);
        expect(cookiesStub.set).toHaveBeenCalledWith(expect.objectContaining({
            name: 'pick',
            value: 'secret_value',
            storeId: 'firefox-private',
        }));
    });

    it('Firefox: does not touch the jar for an incognito request without cookieStoreId', async () => {
        const cookieRule = createNetworkRule('||example.org^$cookie=pick;maxAge=3600', 1);

        await runResponseCase(
            [cookieRule],
            'pick=secret_value',
            { incognito: true },
        );

        expect(cookiesStub.getAll).not.toHaveBeenCalled();
        expect(cookiesStub.remove).not.toHaveBeenCalled();
        expect(cookiesStub.set).not.toHaveBeenCalled();
    });

    it('Chromium spanning: resolves the incognito cookie store from the originating tab', async () => {
        const cookieRule = createNetworkRule('||example.org^$cookie=c_user', 1);
        detectorState.isFirefox = false;

        getTabIncognitoStateSpy.mockImplementation((tabId: number) => tabId === 5);
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

        getTabIncognitoStateSpy.mockImplementation((tabId: number) => tabId === 5);
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

        getTabIncognitoStateSpy.mockReturnValue(undefined);
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

    it('Chromium spanning: does not touch the jar when the incognito store cannot be resolved', async () => {
        const cookieRule = createNetworkRule('||example.org^$cookie=c_user', 1);
        detectorState.isFirefox = false;

        getTabIncognitoStateSpy.mockImplementation((tabId: number) => tabId === 5);
        // Only the regular store is reported (e.g. the incognito store is gone).
        cookiesStub.getAllCookieStores.mockResolvedValue([{ id: '0', tabIds: [1] }]);

        await runRequestCase(
            [cookieRule],
            'c_user=test_value',
            { tabId: 5 },
        );

        expect(cookiesStub.remove).not.toHaveBeenCalled();
        expect(cookiesStub.set).not.toHaveBeenCalled();
    });

    it('Chromium spanning: does not touch the jar when the tab state cannot be determined', async () => {
        const cookieRule = createNetworkRule('||example.org^$cookie=c_user', 1);
        detectorState.isFirefox = false;

        getTabIncognitoStateSpy.mockReturnValue(undefined);
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

    it('does not resolve the store scope when no cookie rules matched', async () => {
        detectorState.isFirefox = false;

        await runRequestCase(
            [],
            'c_user=test_value',
            { tabId: 5 },
        );

        expect(getTabIncognitoStateSpy).not.toHaveBeenCalled();
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
