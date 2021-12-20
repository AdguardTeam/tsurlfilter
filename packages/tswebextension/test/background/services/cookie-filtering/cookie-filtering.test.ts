/* eslint-disable max-len */
import { WebRequest } from 'webextension-polyfill';
import { CookieFiltering } from '../../../../src/background/services/cookie-filtering/cookie-filtering';
import { MockFilteringLog } from '../../mock-filtering-log';
import { MatchingResult, NetworkRule, RequestType } from '@adguard/tsurlfilter';
import BrowserCookieApi from '../../../../src/background/services/cookie-filtering/browser-cookie/browser-cookie-api';
import { RequestContext, requestContextStorage } from '../../../../src/background/request/request-context-storage';
import { ContentType } from '../../../../src/background/request/request-type';
import OnBeforeSendHeadersDetailsType = WebRequest.OnBeforeSendHeadersDetailsType;
import OnHeadersReceivedDetailsType = WebRequest.OnHeadersReceivedDetailsType;
import HttpHeaders = WebRequest.HttpHeaders;

jest.mock('../../../../src/background/services/cookie-filtering/browser-cookie/browser-cookie-api');
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
    let details: any;
    let context: RequestContext;

    beforeEach(() => {
        mockFilteringLog = new MockFilteringLog();
        cookieFiltering = new CookieFiltering(mockFilteringLog);

        context = {
            requestId: '1',
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
            htmlRules: undefined,
            contentTypeHeader: undefined,
        };

        details = {
            frameId: 0,
            method: 'GET',
            parentFrameId: 0,
            requestId: '1',
            tabId: 0,
            thirdParty: false,
            timeStamp: 0,
            type: 'main_frame',
            url: 'https://example.org',
        };
    });

    const runCase = async (rules: NetworkRule[], requestHeaders: HttpHeaders, responseHeaders?: HttpHeaders): Promise<void> => {
        context.matchingResult = new MatchingResult(rules, null);
        requestContextStorage.record(details.requestId, context);

        cookieFiltering.onBeforeSendHeaders({
            requestHeaders,
            ...details,
        } as OnBeforeSendHeadersDetailsType);

        await cookieFiltering.onHeadersReceived({
            statusCode: 200,
            statusLine: 'OK',
            responseHeaders,
            ...details,
        } as OnHeadersReceivedDetailsType);

        requestContextStorage.delete(details.requestId);
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
        details.thirdParty = true;

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

        expect(mockFilteringLog.addCookieEvent).toHaveBeenLastCalledWith(expect.objectContaining({
            cookieDomain: 'example.org',
            cookieName: 'third_party_user',
            cookieRule: thirdPartyCookieRule,
            isModifyingCookieRule: false,
            thirdParty: true,
        }));
    });

    it('filters blocking rules', () => {
        const rules = [
            new NetworkRule('||example.org^$cookie=c_user', 1),
            new NetworkRule('||example.org^$third-party,cookie=third_party_user', 1),
            new NetworkRule('||example.org^$cookie=m_user;sameSite=lax', 1),
        ];

        context.matchingResult = new MatchingResult(rules, null);
        requestContextStorage.record(details.requestId, context);

        let result = cookieFiltering.getBlockingRules(details.requestId);
        expect(result).toHaveLength(2);

        result = cookieFiltering.getBlockingRules(details.requestId + 1);
        expect(result).toHaveLength(0);

        requestContextStorage.delete(details.requestId);
    });

    it('checks invalids', async () => {
        const rules: NetworkRule[] = [];

        context.matchingResult = new MatchingResult(rules, null);
        requestContextStorage.record(details.requestId, context);

        cookieFiltering.onBeforeSendHeaders({
            requestHeaders: undefined,
            ...details,
        } as OnBeforeSendHeadersDetailsType);

        await cookieFiltering.onHeadersReceived({
            statusCode: 200,
            statusLine: 'OK',
            ...details,
        } as OnHeadersReceivedDetailsType);

        expect(mockFilteringLog.addCookieEvent).not.toHaveBeenCalled();

        requestContextStorage.delete(details.requestId);

        details.requestId += 1;
        requestContextStorage.record(details.requestId, context);

        cookieFiltering.onBeforeSendHeaders({
            requestHeaders: [],
            ...details,
        } as OnBeforeSendHeadersDetailsType);

        await cookieFiltering.onHeadersReceived({
            statusCode: 200,
            statusLine: 'OK',
            ...details,
        } as OnHeadersReceivedDetailsType);

        expect(mockFilteringLog.addCookieEvent).not.toHaveBeenCalled();

        requestContextStorage.delete(details.requestId);
    });
});
