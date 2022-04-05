/* eslint-disable max-len */
import browser from 'sinon-chrome';
import { WebRequest } from 'webextension-polyfill';
import { MatchingResult, NetworkRule, RequestType } from '@adguard/tsurlfilter';

import { CookieFiltering } from '@lib/mv2/background/services/cookie-filtering/cookie-filtering';
import BrowserCookieApi from '@lib/mv2/background/services/cookie-filtering/browser-cookie/browser-cookie-api';
import { RequestContext, RequestContextState, requestContextStorage } from '@lib/mv2/background/request/request-context-storage';
import { ContentType } from '@lib/mv2/background/request/request-type';
import { tabsApi } from '@lib/mv2/background/tabs';
import { FrameRequestService } from '@lib/mv2/background/services/frame-request-service';

import { MockFilteringLog } from '../../../../common/mock-filtering-log';

import HttpHeaders = WebRequest.HttpHeaders;

jest.mock('@lib/mv2/background/services/cookie-filtering/browser-cookie/browser-cookie-api');

BrowserCookieApi.prototype.removeCookie = jest.fn().mockImplementation(() => true);
BrowserCookieApi.prototype.modifyCookie = jest.fn().mockImplementation(() => true);

const createTestHeaders = (headers: { name: string;value: string }[]): { name: string;value: string }[] => [
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
            state: RequestContextState.HEADERS_RECEIVED,
            requestId,
            requestUrl: 'https://example.org',
            referrerUrl: 'https://example.org',
            requestType: RequestType.Document,
            contentType: ContentType.DOCUMENT,
            statusCode: 200,
            tabId: 0,
            frameId: 0,
            requestFrameId: 0,
            timestamp: Date.now(),
            thirdParty: false,
            matchingResult: new MatchingResult([], null),
            cookies: undefined,
            contentTypeHeader: undefined,
        };
    });

    const runCase = async (rules: NetworkRule[], requestHeaders: HttpHeaders, responseHeaders?: HttpHeaders): Promise<void> => {
        context.matchingResult = new MatchingResult(rules, null);
        context.requestHeaders = requestHeaders;
        context.responseHeaders = responseHeaders;

        requestContextStorage.record(requestId, context);

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

        expect(mockFilteringLog.addCookieEvent).not.toHaveBeenCalled();
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

        expect(mockFilteringLog.addCookieEvent).toHaveBeenLastCalledWith(expect.objectContaining({
            cookieDomain: 'example.org',
            cookieName: 'c_user',
            cookieRule,
            isModifyingCookieRule: false,
            thirdParty: false,
        }));
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
        expect(mockFilteringLog.addCookieEvent).toHaveBeenLastCalledWith(expect.objectContaining({
            cookieDomain: 'example.org',
            cookieName: 'pick',
            cookieRule: allowlistRule,
            isModifyingCookieRule: false,
            thirdParty: false,
        }));
    });

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

        await runCase(rules, requestHeaders);
        expect(mockFilteringLog.addCookieEvent).toHaveBeenLastCalledWith(expect.objectContaining({
            cookieDomain: 'example.org',
            cookieName: 'pick',
            cookieRule: allowlistRule,
            isModifyingCookieRule: false,
            thirdParty: false,
        }));
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

        await runCase(rules, requestHeaders);

        expect(mockFilteringLog.addCookieEvent).toHaveBeenLastCalledWith(expect.objectContaining({
            cookieDomain: 'example.org',
            cookieName: 'c_user',
            cookieValue: 'test_value',
            cookieRule,
            isModifyingCookieRule: true,
            thirdParty: false,
        }));
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

        expect(mockFilteringLog.addCookieEvent).toHaveBeenLastCalledWith(expect.objectContaining({
            cookieDomain: 'example.org',
            cookieName: 'c_user',
            cookieValue: 'test_value',
            cookieRule,
            isModifyingCookieRule: true,
            thirdParty: false,
        }));
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

        expect(mockFilteringLog.addCookieEvent).toHaveBeenLastCalledWith(expect.objectContaining({
            cookieDomain: 'example.org',
            cookieName: 'third_party_user',
            cookieRule: thirdPartyCookieRule,
            isModifyingCookieRule: false,
            thirdParty: true,
        }));
    });

    it('filters blocking rules', async () => {
        const rules = [
            new NetworkRule('||example.org^$cookie=c_user', 1),
            new NetworkRule('||example.org^$third-party,cookie=third_party_user', 1),
            new NetworkRule('||example.org^$cookie=m_user;sameSite=lax', 1),
        ];

        await tabsApi.start();
        FrameRequestService.start();

        browser.tabs.onCreated.dispatch({ id: 0 });

        tabsApi.recordRequestFrame(0, 0, 'https://example.org', RequestType.Document);

        context.matchingResult = new MatchingResult(rules, null);
        requestContextStorage.record(requestId, context);

        let result = cookieFiltering.getBlockingRules('https://example.org', 0, 0);
        expect(result).toHaveLength(2);

        result = cookieFiltering.getBlockingRules('https://another.org', 0, 0);
        expect(result).toHaveLength(0);

        requestContextStorage.delete(requestId);

        FrameRequestService.stop();
        tabsApi.stop();
    });

    it('checks invalids', async () => {
        const rules: NetworkRule[] = [];

        context.matchingResult = new MatchingResult(rules, null);
        requestContextStorage.record(requestId, context);

        cookieFiltering.onBeforeSendHeaders(context);

        cookieFiltering.onHeadersReceived(context);

        expect(mockFilteringLog.addCookieEvent).not.toHaveBeenCalled();

        requestContextStorage.delete(requestId);

        requestId += 1;
        requestContextStorage.record(requestId, context);

        cookieFiltering.onBeforeSendHeaders(context);

        cookieFiltering.onHeadersReceived(context);

        expect(mockFilteringLog.addCookieEvent).not.toHaveBeenCalled();

        requestContextStorage.delete(requestId);
    });
});
