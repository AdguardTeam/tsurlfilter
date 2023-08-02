import browser from 'sinon-chrome';
import { WebRequest } from 'webextension-polyfill';
import { MatchingResult, NetworkRule, RequestType } from '@adguard/tsurlfilter';

import { CookieFiltering } from '@lib/mv2/background/services/cookie-filtering/cookie-filtering';
import { BrowserCookieApi } from '@lib/common/cookie-filtering/browser-cookie-api';
import {
    RequestContext,
    RequestContextState,
    requestContextStorage,
} from '@lib/mv2/background/request/request-context-storage';
import { FilteringEventType, ContentType } from '@lib/common';
import { tabsApi } from '@lib/mv2/background/api';

import { MockFilteringLog } from '../../../../common/mocks';

import HttpHeaders = WebRequest.HttpHeaders;

jest.mock('../../../../../../src/lib/common/utils/logger');
jest.mock('@lib/common/cookie-filtering/browser-cookie-api');

BrowserCookieApi.prototype.removeCookie = jest.fn().mockImplementation(() => true);
BrowserCookieApi.prototype.modifyCookie = jest.fn().mockImplementation(() => true);

type SimulatedHeader = {
    name: string,
    value: string,
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
            method: 'GET',
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
        const cookieRule = new NetworkRule('||example.org^$cookie=c_user', 1);
        const rules = [
            cookieRule,
        ];

        const requestHeaders = createTestHeaders([]);

        await runCase(rules, requestHeaders);

        expect(mockFilteringLog.publishEvent).not.toHaveBeenCalled();
    });

    it('checks remove rule', async () => {
        const cookieRule = new NetworkRule('||example.org^$cookie=c_user', 1);
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
                rule: cookieRule,
                isModifyingCookieRule: false,
                requestThirdParty: false,
            }),
        });
    });

    it('checks cookie specific allowlist rule', async () => {
        const cookieRule = new NetworkRule('$cookie=/pick|other/,domain=example.org|other.com', 1);
        const allowlistRule = new NetworkRule('@@||example.org^$cookie=pick', 1);
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
                rule: allowlistRule,
                isModifyingCookieRule: false,
                requestThirdParty: false,
            }),
        });
    });

    // TODO: Add more edge-cases

    it('checks cookie specific allowlist regex rule', async () => {
        const cookieRule = new NetworkRule('||example.org^$cookie=/pick|other/,domain=example.org|other.com', 1);
        const allowlistRule = new NetworkRule('@@||example.org^$cookie=/pick|one_more/', 1);
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
                rule: allowlistRule,
                isModifyingCookieRule: false,
                requestThirdParty: false,
            }),
        });
    });

    it('checks modifying rule - max age', async () => {
        const cookieRule = new NetworkRule('||example.org^$cookie=c_user;maxAge=15', 1);
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
                rule: cookieRule,
                isModifyingCookieRule: true,
                requestThirdParty: false,
            }),
        });
    });

    it('checks modifying rule - sameSite', async () => {
        const cookieRule = new NetworkRule('||example.org^$cookie=c_user;sameSite=lax', 1);
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
                rule: cookieRule,
                isModifyingCookieRule: true,
                requestThirdParty: false,
            }),
        });
    });

    it('checks remove rule - third-party cases', async () => {
        context.thirdParty = true;

        const thirdPartyCookieRule = new NetworkRule('||example.org^$third-party,cookie=third_party_user', 1);
        const rules = [
            new NetworkRule('||example.org^$cookie=c_user', 1),
            thirdPartyCookieRule,
        ];

        const requestHeaders = createTestHeaders([{
            name: 'Cookie',
            value: 'smth=test_value',
        }]);

        const setCookieHeader = { name: 'set-cookie', value: 'third_party_user=test;' };
        const responseHeaders = [setCookieHeader];

        await runCase(rules, requestHeaders, responseHeaders);

        expect(responseHeaders).toEqual([]);

        expect(mockFilteringLog.publishEvent).toHaveBeenLastCalledWith({
            type: FilteringEventType.Cookie,
            data: expect.objectContaining({
                frameDomain: 'example.org',
                cookieName: 'third_party_user',
                rule: thirdPartyCookieRule,
                isModifyingCookieRule: false,
                requestThirdParty: true,
            }),
        });
    });

    it('filters blocking rules', async () => {
        const rules = [
            new NetworkRule('||example.org^$cookie=c_user', 1),
            new NetworkRule('||example.org^$third-party,cookie=third_party_user', 1),
            new NetworkRule('||example.org^$cookie=m_user;sameSite=lax', 1),
        ];

        await tabsApi.start();

        browser.tabs.onCreated.dispatch({ id: 0 });

        tabsApi.handleFrameRequest(context);

        context.matchingResult = new MatchingResult(rules, null);

        tabsApi.handleFrameMatchingResult(
            context.tabId,
            context.frameId,
            context.matchingResult,
        );

        requestContextStorage.set(requestId, context);

        expect(CookieFiltering.getBlockingRules(context.tabId, context.frameId)).toHaveLength(2);

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
