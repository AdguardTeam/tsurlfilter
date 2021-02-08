import { CookieFiltering } from '../../src/cookie-filtering/cookie-filtering';
import { MockFilteringLog } from '../mock-filtering-log';
import { NetworkRule } from '../../src';

// TODO: This mock doesn't work :(
jest.mock('../../src/cookie-filtering/browser-cookie/browser-cookie-api');

const createTestHeaders = (headers: {name: string;value: string}[]): {name: string;value: string}[] => [
    { name: 'Header One', value: 'Header Value One' },
    ...headers,
];

describe('Cookie filtering', () => {
    let cookieFiltering: CookieFiltering;
    let mockFilteringLog: MockFilteringLog;

    beforeEach(() => {
        mockFilteringLog = new MockFilteringLog();
        cookieFiltering = new CookieFiltering(mockFilteringLog);
    });

    it('checks remove rule', async () => {
        const rules = [
            new NetworkRule('||example.org^$cookie=c_user', 1),
        ];

        cookieFiltering.onBeforeRequest({
            frameId: 0,
            method: 'GET',
            parentFrameId: 0,
            requestId: '1',
            tabId: 0,
            thirdParty: false,
            timeStamp: 0,
            type: 'main_frame',
            url: 'https://example.org',
        }, rules);

        cookieFiltering.onBeforeSendHeaders({
            frameId: 0,
            method: 'GET',
            parentFrameId: 0,
            requestId: '1',
            tabId: 0,
            thirdParty: false,
            timeStamp: 0,
            type: 'main_frame',
            url: 'https://example.org',
            requestHeaders: createTestHeaders([{
                name: 'Cookie',
                value: 'c_user=test_value',
            }]),
        });

        await cookieFiltering.onHeadersReceived({
            frameId: 0,
            method: 'GET',
            parentFrameId: 0,
            requestId: '1',
            tabId: 0,
            thirdParty: false,
            timeStamp: 0,
            type: 'main_frame',
            url: 'https://example.org',
            statusCode: 200,
            statusLine: 'OK',
        });

        cookieFiltering.onCompleted({
            frameId: 0,
            method: 'GET',
            parentFrameId: 0,
            requestId: '1',
            tabId: 0,
            thirdParty: false,
            timeStamp: 0,
            type: 'main_frame',
            url: 'https://example.org',
            statusCode: 200,
            statusLine: 'OK',
            fromCache: false,
            requestSize: 0,
            responseSize: 0,
            urlClassification: { firstParty: ['fingerprinting'], thirdParty: ['fingerprinting'] },
        });

        expect(mockFilteringLog.addCookieEvent).toHaveBeenLastCalledWith('c_user', 'http://example.org');
    });
});
