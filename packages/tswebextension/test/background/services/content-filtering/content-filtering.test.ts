/**
 * @jest-environment jsdom
 */

/* eslint-disable max-len */
import { TextDecoder, TextEncoder } from 'text-encoding';
import { WebRequest } from 'webextension-polyfill/namespaces/webRequest';
import { CosmeticRule, NetworkRule, MatchingResult, RequestType } from '@adguard/tsurlfilter';
import { MockStreamFilter } from './mock-stream-filter';
import {
    DEFAULT_CHARSET,
    parseCharsetFromHeader,
    WIN_1251,
} from '../../../../src/background/services/content-filtering/charsets';
import { ContentFiltering } from '../../../../src/background/services/content-filtering/content-filtering';
import { MockFilteringLog } from '../../mock-filtering-log';
import { RequestContext, requestContextStorage } from '../../../../src/background/request/request-context-storage';
import { ContentType } from '../../../../src/background/request/request-type';

describe('Content filtering', () => {
    const textEncoderUtf8 = new TextEncoder();
    const textDecoderUtf8 = new TextDecoder();

    const testData = '<html><body><script>test</script></body></html>';

    let context: RequestContext;
    let details: WebRequest.OnBeforeRequestDetailsType;

    beforeEach(() => {
        context = {
            requestId: '1',
            requestUrl: 'https://example.org',
            referrerUrl: 'https://example.org',
            requestType: RequestType.Document,
            contentType: ContentType.DOCUMENT,
            statusCode: 200,
            tabId: 1,
            frameId: 1,
            requestFrameId: 1,
            timestamp: Date.now(),
            thirdParty: false,
            matchingResult: new MatchingResult([], null),
            contentTypeHeader: undefined,
            htmlRules: undefined,
            cookies: undefined,
        };

        details = {
            frameId: 0,
            method: 'GET',
            parentFrameId: 0,
            requestId: '1',
            tabId: 1,
            thirdParty: false,
            timeStamp: 0,
            type: 'main_frame',
            url: 'https://example.org',
        };
    });

    const runCase = (expected: string): void => {
        requestContextStorage.record(details.requestId, context);

        const mockFilter = new MockStreamFilter();
        const contentFiltering = new ContentFiltering(new MockFilteringLog());

        contentFiltering.onBeforeRequest(mockFilter, details as WebRequest.OnBeforeRequestDetailsType);

        mockFilter.send(textEncoderUtf8.encode(testData));
        const received = textDecoderUtf8.decode(mockFilter.receive());

        expect(received).not.toBeNull();
        expect(received).toBe(expected);

        requestContextStorage.delete(details.requestId);
    };

    it('checks html rules', () => {
        context.contentTypeHeader = 'text/html; charset=utf-8';
        context.htmlRules = [
            new CosmeticRule('example.org$$script[tag-content="test"]', 1),
        ];

        const expected = '<html><head></head><body></body></html>';
        runCase(expected);
    });

    it('checks replace rules', () => {
        const rules = [
            new NetworkRule('||example.org^$replace=/test/test1/g', 1),
            new NetworkRule('||example.org^$replace=/smth/smth1/g', 1),
            new NetworkRule('||example.org^$replace=/smth/smth2/g', 1),
            new NetworkRule('||example.org^$replace=/smth/smth2/g', 1),
            new NetworkRule('||example.org^$replace=/smth/smth3/g', 1),
            new NetworkRule('@@||example.org^$replace=/smth/smth3/g', 1),
        ];

        context.contentTypeHeader = 'text/html; charset=utf-8';
        context.matchingResult = new MatchingResult(rules, null);

        const expected = '<html><body><script>test1</script></body></html>';
        runCase(expected);
    });

    it('checks replace rules - sorting', () => {
        const rules = [
            new NetworkRule('||example.org^$replace=/smth/smth1/g', 1),
            new NetworkRule('||example.org^$replace=/test/test1/g', 1),
        ];

        context.contentTypeHeader = 'text/html; charset=utf-8';
        context.matchingResult = new MatchingResult(rules, null);

        const expected = '<html><body><script>test1</script></body></html>';
        runCase(expected);
    });

    it('checks replace rules - content type', () => {
        const rules = [
            new NetworkRule('||example.org^$replace=/test/test1/g', 1),
        ];

        context.contentTypeHeader = 'application/json; charset=utf-8';
        context.matchingResult = new MatchingResult(rules, null);

        const expected = '<html><body><script>test1</script></body></html>';
        runCase(expected);
    });

    it('checks empty cases - no rules', () => {
        context.contentTypeHeader = 'text/html; charset=utf-8';
        context.matchingResult = new MatchingResult([], null);

        runCase(testData);
    });

    it('checks empty cases - status code', () => {
        const rules = [
            new NetworkRule('||example.org^$replace=/smth/smth1/g', 1),
            new NetworkRule('||example.org^$replace=/test/test1/g', 1),
        ];

        context.contentTypeHeader = 'text/html; charset=utf-8';
        context.matchingResult = new MatchingResult(rules, null);
        context.statusCode = 304;

        runCase(testData);
    });

    it('checks empty cases - method', () => {
        const rules = [
            new NetworkRule('||example.org^$replace=/smth/smth1/g', 1),
            new NetworkRule('||example.org^$replace=/test/test1/g', 1),
        ];

        context.contentTypeHeader = 'text/html; charset=utf-8';
        context.matchingResult = new MatchingResult(rules, null);
        details.method = 'PUT';

        runCase('');
    });

    it('checks empty cases - unsupported charset', () => {
        const rules = [
            new NetworkRule('||example.org^$replace=/smth/smth1/g', 1),
            new NetworkRule('||example.org^$replace=/test/test1/g', 1),
        ];

        context.contentTypeHeader = 'text/html; charset=koi8-r';
        context.matchingResult = new MatchingResult(rules, null);

        runCase(testData);
    });
});

describe('Content filtering - charsets', () => {
    it('checks charset parsing', () => {
        expect(parseCharsetFromHeader('text/html; charset=utf-8')).toBe(DEFAULT_CHARSET);
        expect(parseCharsetFromHeader('text/html; charset=windows-1251')).toBe(WIN_1251);
        expect(parseCharsetFromHeader('text/html; charset="windows-1251"')).toBe(WIN_1251);
        expect(parseCharsetFromHeader('')).toBeNull();
        expect(parseCharsetFromHeader('smth else')).toBeNull();
    });
});
