import {
    describe,
    expect,
    beforeEach,
    it,
    vi,
} from 'vitest';
import browser from 'sinon-chrome';
import polyfillBrowser from 'webextension-polyfill';
import {
    HTTPMethod,
    MatchingResult,
    type NetworkRule,
    RequestType,
} from '@adguard/tsurlfilter';

import { createNetworkRule } from '../../../../../helpers/rule-creator';
import { MockFilteringLog } from '../../../../common/mocks';
import { getNetworkRuleFields } from '../../helpers/rule-fields';
import { BrowserCookieApi } from '../../../../../../src/lib/common/cookie-filtering/browser-cookie-api';
import { CookieFiltering } from '../../../../../../src/lib/mv2/background/services/cookie-filtering/cookie-filtering';
import {
    engineApi,
    type RequestContext,
    RequestContextState,
    requestContextStorage,
    tabsApi,
} from '../../../../../../src/lib';
import { ContentType } from '../../../../../../src/lib/common/request-type';
import { FilteringEventType } from '../../../../../../src/lib/common/filtering-log';

import HttpHeaders = polyfillBrowser.WebRequest.HttpHeaders;

vi.mock('../../../../../../src/lib/common/utils/logger');
vi.mock('../../../../../../src/lib/common/cookie-filtering/browser-cookie-api');
vi.mock('../../../../../../src/lib/mv2/background/engine-api');

BrowserCookieApi.prototype.removeCookie = vi.fn().mockImplementation(() => true);
BrowserCookieApi.prototype.modifyCookie = vi.fn().mockImplementation(() => true);

type SimulatedHeader = {
    name: string;
    value: string;
};

const createTestHeaders = (headers: SimulatedHeader[]): SimulatedHeader[] => [
    { name: 'Header One', value: 'Header Value One' },
    ...headers,
];

describe('Cookie filtering', () => {
    let cookieFiltering: CookieFiltering;
    let mockFilteringLog: MockFilteringLog;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let requestId: string;
    let context: RequestContext;

    beforeEach(() => {
        mockFilteringLog = new MockFilteringLog();
        cookieFiltering = new CookieFiltering(mockFilteringLog);

        requestId = '1';

        context = {
            eventId: '1',
            state: RequestContextState.HeadersReceived,
            requestId,
            requestUrl: 'https://example.org',
            referrerUrl: 'https://example.org',
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

    const runCase = async (
        rules: NetworkRule[],
        requestHeaders: HttpHeaders,
        responseHeaders?: HttpHeaders,
    ): Promise<void> => {
        context.matchingResult = new MatchingResult(rules, null);
        context.requestHeaders = requestHeaders;
        context.responseHeaders = responseHeaders;

        requestContextStorage.set(requestId, context);

        cookieFiltering.onBeforeSendHeaders(context);

        cookieFiltering.onHeadersReceived(context);

        requestContextStorage.delete(requestId);
    };

    it('checks empty', async () => {
        const cookieRule = createNetworkRule('||example.org^$cookie=c_user', 1);
        const rules = [
            cookieRule,
        ];

        const requestHeaders = createTestHeaders([]);

        await runCase(rules, requestHeaders);

        expect(mockFilteringLog.publishEvent).not.toHaveBeenCalled();
    });

    it('checks remove rule', async () => {
        const cookieRule = createNetworkRule('||example.org^$cookie=c_user', 1);
        const rules = [
            cookieRule,
        ];

        const requestHeaders = createTestHeaders([{
            name: 'Cookie',
            value: 'c_user=test_value',
        }]);

        await runCase(rules, requestHeaders);

        expect(mockFilteringLog.publishEvent).toHaveBeenLastCalledWith({
            type: FilteringEventType.Cookie,
            data: expect.objectContaining({
                frameDomain: 'example.org',
                cookieName: 'c_user',
                isModifyingCookieRule: false,
                requestThirdParty: false,
                ...getNetworkRuleFields(cookieRule),
            }),
        });
    });

    it('checks cookie specific allowlist rule', async () => {
        const cookieRule = createNetworkRule('$cookie=/pick|other/,domain=example.org|other.com', 1);
        const allowlistRule = createNetworkRule('@@||example.org^$cookie=pick', 1);
        const rules = [
            cookieRule,
            allowlistRule,
        ];

        const requestHeaders = createTestHeaders([{
            name: 'Cookie',
            value: 'pick=test_value',
        }]);

        await runCase(rules, requestHeaders);
        expect(mockFilteringLog.publishEvent).toHaveBeenLastCalledWith({
            type: FilteringEventType.Cookie,
            data: expect.objectContaining({
                frameDomain: 'example.org',
                cookieName: 'pick',
                isModifyingCookieRule: false,
                requestThirdParty: false,
                ...getNetworkRuleFields(allowlistRule),
            }),
        });
    });

    // TODO: Add more edge-cases

    it('does not attempt to apply rules if there are no modifying ones', async () => {
        const allowlistRule = createNetworkRule('@@||example.org^$cookie=pick', 1);
        const rules = [allowlistRule];

        const responseHeaders = createTestHeaders([{
            name: 'set-cookie',
            value: 'pick=updated_value',
        }]);

        await runCase(rules, [], responseHeaders);

        expect(mockFilteringLog.publishEvent).toHaveBeenCalledTimes(2);
        expect(mockFilteringLog.publishEvent).toHaveBeenLastCalledWith({
            type: FilteringEventType.Cookie,
            data: expect.objectContaining({
                frameDomain: 'example.org',
                cookieName: 'pick',
                isModifyingCookieRule: false,
                requestThirdParty: false,
                ...getNetworkRuleFields(allowlistRule),
            }),
        });
    });

    it('checks cookie specific allowlist regex rule', async () => {
        const cookieRule = createNetworkRule('||example.org^$cookie=/pick|other/,domain=example.org|other.com', 1);
        const allowlistRule = createNetworkRule('@@||example.org^$cookie=/pick|one_more/', 1);
        const rules = [
            cookieRule,
            allowlistRule,
        ];

        const requestHeaders = createTestHeaders([{
            name: 'Cookie',
            value: 'pick=test_value',
        }]);

        const responseHeaders = createTestHeaders([{
            name: 'Cookie',
            value: 'pick=updated_value',
        }]);

        await runCase(rules, requestHeaders, responseHeaders);
        expect(mockFilteringLog.publishEvent).toHaveBeenLastCalledWith({
            type: FilteringEventType.Cookie,
            data: expect.objectContaining({
                frameDomain: 'example.org',
                cookieName: 'pick',
                isModifyingCookieRule: false,
                requestThirdParty: false,
                ...getNetworkRuleFields(allowlistRule),
            }),
        });
    });

    it('checks modifying rule - max age', async () => {
        const cookieRule = createNetworkRule('||example.org^$cookie=c_user;maxAge=15', 1);
        const rules = [
            cookieRule,
        ];

        const requestHeaders = createTestHeaders([{
            name: 'Cookie',
            value: 'c_user=test_value',
        }]);

        const responseHeaders = createTestHeaders([{
            name: 'Set-Cookie',
            value: 'c_user=new_value',
        }]);

        await runCase(rules, requestHeaders, responseHeaders);

        expect(mockFilteringLog.publishEvent).toHaveBeenLastCalledWith({
            type: FilteringEventType.Cookie,
            data: expect.objectContaining({
                frameDomain: 'example.org',
                cookieName: 'c_user',
                cookieValue: 'new_value',
                isModifyingCookieRule: true,
                requestThirdParty: false,
                ...getNetworkRuleFields(cookieRule),
            }),
        });
    });

    it('checks modifying rule - sameSite', async () => {
        const cookieRule = createNetworkRule('||example.org^$cookie=c_user;sameSite=lax', 1);
        const rules = [
            cookieRule,
        ];

        const requestHeaders = createTestHeaders([{
            name: 'Cookie',
            value: 'c_user=test_value',
        }]);

        await runCase(rules, requestHeaders);

        expect(mockFilteringLog.publishEvent).toHaveBeenLastCalledWith({
            type: FilteringEventType.Cookie,
            data: expect.objectContaining({
                frameDomain: 'example.org',
                cookieName: 'c_user',
                cookieValue: 'test_value',
                isModifyingCookieRule: true,
                requestThirdParty: false,
                ...getNetworkRuleFields(cookieRule),
            }),
        });
    });

    it('checks remove rule - third-party cases', async () => {
        context.thirdParty = true;

        const thirdPartyCookieRule = createNetworkRule('||example.org^$third-party,cookie=third_party_user', 1);
        const rules = [
            createNetworkRule('||example.org^$cookie=c_user', 1),
            thirdPartyCookieRule,
        ];

        const requestHeaders = createTestHeaders([{
            name: 'Cookie',
            value: 'smth=test_value',
        }]);

        const setCookieHeader = { name: 'set-cookie', value: 'third_party_user=test;' };
        const responseHeaders = [setCookieHeader];

        await runCase(rules, requestHeaders, responseHeaders);

        expect(mockFilteringLog.publishEvent).toHaveBeenLastCalledWith(
            expect.objectContaining({
                type: FilteringEventType.Cookie,
                data: expect.objectContaining({
                    frameDomain: 'example.org',
                    cookieName: 'third_party_user',
                    isModifyingCookieRule: false,
                    requestThirdParty: true,
                    ...getNetworkRuleFields(thirdPartyCookieRule),
                }),
            }),
        );
    });

    it('filters blocking rules', async () => {
        const rules = [
            createNetworkRule('||example.org^$cookie=c_user', 1),
            createNetworkRule('||example.org^$third-party,cookie=third_party_user', 1),
            createNetworkRule('||example.org^$cookie=m_user;sameSite=lax', 1),
        ];

        await tabsApi.start();

        browser.tabs.onCreated.dispatch({ id: 0, url: 'https://example.org' });

        vi.spyOn(engineApi, 'matchRequest').mockImplementationOnce(() => new MatchingResult(rules, null));

        expect(cookieFiltering.getBlockingRules(context.referrerUrl, context.tabId, context.frameId)).toHaveLength(2);

        requestContextStorage.delete(requestId);

        tabsApi.stop();
    });

    it('checks invalids', async () => {
        const rules: NetworkRule[] = [];

        context.matchingResult = new MatchingResult(rules, null);
        requestContextStorage.set(requestId, context);

        cookieFiltering.onBeforeSendHeaders(context);

        cookieFiltering.onHeadersReceived(context);

        expect(mockFilteringLog.publishEvent).not.toHaveBeenCalled();

        requestContextStorage.delete(requestId);

        requestId += 1;
        requestContextStorage.set(requestId, context);

        cookieFiltering.onBeforeSendHeaders(context);

        cookieFiltering.onHeadersReceived(context);

        expect(mockFilteringLog.publishEvent).not.toHaveBeenCalled();

        requestContextStorage.delete(requestId);
    });
});
