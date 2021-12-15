/**
 * @jest-environment jsdom
 */

import { TextDecoder, TextEncoder } from 'text-encoding';
import { MockStreamFilter } from './mock-stream-filter';
import { IRule, CosmeticRule, NetworkRule, Request, RequestType } from '@adguard/tsurlfilter';
// eslint-disable-next-line max-len
import { DEFAULT_CHARSET, parseCharsetFromHeader, WIN_1251 } from '../../../../src/background/services/content-filtering/charsets';
import { ModificationsListener } from '../../../../src/background/services/content-filtering/modifications-listener';
import { ContentFiltering } from '../../../../src/background/services/content-filtering/content-filtering';

class MockFilteringLog implements ModificationsListener {
    onHtmlRuleApplied = jest.fn(
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        (tabId: number, requestId: number, innerHTML: string, frameUrl: string | null, rule: IRule) => {
            // Do nothing
        },
    );

    onReplaceRulesApplied = jest.fn(
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        (tabId: number, requestId: number, frameUrl: string | null, appliedRules: IRule[]) => {
            // Do nothing
        },
    );

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    onModificationFinished = jest.fn((requestId: number) => {
        // Do nothing
    });

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    onModificationStarted = jest.fn((requestId: number) => {
        // Do nothing
    });
}

const createTestRequest = (requestType?: RequestType): Request => {
    const type = requestType ? requestType! : RequestType.Document;
    const request = new Request('https://example.org', '', type);
    request.requestId = 1;
    request.tabId = 1;
    request.statusCode = 200;
    request.method = 'GET';

    return request;
};

describe('Content filtering', () => {
    const textEncoderUtf8 = new TextEncoder();
    const textDecoderUtf8 = new TextDecoder();

    const testData = '<html><body><script>test</script></body></html>';

    // eslint-disable-next-line max-len
    const checkResult = (mockFilter: MockStreamFilter, encoder: TextEncoder, decoder: TextDecoder, data: string, expected: string): void => {
        mockFilter.send(encoder.encode(data));
        const received = decoder.decode(mockFilter.receive());

        expect(received).not.toBeNull();
        expect(received).toBe(expected);
    };

    it('checks html rules', () => {
        const request = createTestRequest();

        const mockFilter = new MockStreamFilter();
        const contentFiltering = new ContentFiltering(new MockFilteringLog(), () => {
            return {
                request,
                contentType: 'text/html; charset=utf-8',
                statusCode: request.statusCode!,
            };
        });

        const rules = [
            new CosmeticRule('example.org$$script[tag-content="test"]', 1),
        ];

        contentFiltering.onBeforeRequest(mockFilter, request, [], rules);

        const expected = '<html><head></head><body></body></html>';
        checkResult(mockFilter, textEncoderUtf8, textDecoderUtf8, testData, expected);
    });

    it('checks replace rules', () => {
        const request = createTestRequest();

        const mockFilter = new MockStreamFilter();
        const contentFiltering = new ContentFiltering(new MockFilteringLog(), () => {
            return {
                request,
                contentType: 'text/html; charset=utf-8',
                statusCode: request.statusCode!,
            };
        });

        const rules = [
            new NetworkRule('||example.org^$replace=/test/test1/g', 1),
            new NetworkRule('||example.org^$replace=/smth/smth1/g', 1),
            new NetworkRule('||example.org^$replace=/smth/smth2/g', 1),
            new NetworkRule('||example.org^$replace=/smth/smth2/g', 1),
            new NetworkRule('||example.org^$replace=/smth/smth3/g', 1),
            new NetworkRule('@@||example.org^$replace=/smth/smth3/g', 1),
        ];

        contentFiltering.onBeforeRequest(mockFilter, request, rules, []);

        const expected = '<html><body><script>test1</script></body></html>';
        checkResult(mockFilter, textEncoderUtf8, textDecoderUtf8, testData, expected);
    });

    it('checks replace rules - sorting', () => {
        const request = createTestRequest();

        const mockFilter = new MockStreamFilter();
        const contentFiltering = new ContentFiltering(new MockFilteringLog(), () => {
            return {
                request,
                contentType: 'text/html; charset=utf-8',
                statusCode: request.statusCode!,
            };
        });

        const rules = [
            new NetworkRule('||example.org^$replace=/smth/smth1/g', 1),
            new NetworkRule('||example.org^$replace=/test/test1/g', 1),
        ];

        contentFiltering.onBeforeRequest(mockFilter, request, rules, []);

        const expected = '<html><body><script>test1</script></body></html>';
        checkResult(mockFilter, textEncoderUtf8, textDecoderUtf8, testData, expected);
    });

    it('checks replace rules - content type', () => {
        const request = createTestRequest(RequestType.Other);

        const mockFilter = new MockStreamFilter();
        const contentFiltering = new ContentFiltering(new MockFilteringLog(), () => {
            return {
                request,
                contentType: 'application/json; charset=utf-8',
                statusCode: request.statusCode!,
            };
        });

        const rules = [
            new NetworkRule('||example.org^$replace=/test/test1/g', 1),
        ];

        contentFiltering.onBeforeRequest(mockFilter, request, rules, []);

        const expected = '<html><body><script>test1</script></body></html>';
        checkResult(mockFilter, textEncoderUtf8, textDecoderUtf8, testData, expected);
    });

    it('checks empty cases - no rules', () => {
        const request = createTestRequest();

        const mockFilter = new MockStreamFilter();
        const contentFiltering = new ContentFiltering(new MockFilteringLog(), () => {
            return {
                request,
                contentType: 'text/html; charset=utf-8',
                statusCode: request.statusCode!,
            };
        });

        contentFiltering.onBeforeRequest(mockFilter, request, [], []);

        checkResult(mockFilter, textEncoderUtf8, textDecoderUtf8, testData, testData);
    });

    it('checks empty cases - status code', () => {
        const request = createTestRequest();
        request.statusCode = 304;

        const mockFilter = new MockStreamFilter();
        const contentFiltering = new ContentFiltering(new MockFilteringLog(), () => {
            return {
                request,
                contentType: 'text/html; charset=utf-8',
                statusCode: request.statusCode!,
            };
        });

        contentFiltering.onBeforeRequest(mockFilter, request, [], []);

        checkResult(mockFilter, textEncoderUtf8, textDecoderUtf8, testData, testData);
    });

    it('checks empty cases - method', () => {
        const request = createTestRequest();
        request.method = 'PUT';

        const mockFilter = new MockStreamFilter();
        const contentFiltering = new ContentFiltering(new MockFilteringLog(), () => {
            return {
                request,
                contentType: 'text/html; charset=utf-8',
                statusCode: request.statusCode!,
            };
        });

        contentFiltering.onBeforeRequest(mockFilter, request, [], []);

        checkResult(mockFilter, textEncoderUtf8, textDecoderUtf8, testData, '');
    });

    it('checks empty cases - requestId', () => {
        const request = createTestRequest();
        delete request.requestId;

        const mockFilter = new MockStreamFilter();
        const contentFiltering = new ContentFiltering(new MockFilteringLog(), () => {
            return {
                request,
                contentType: 'text/html; charset=utf-8',
                statusCode: request.statusCode!,
            };
        });

        contentFiltering.onBeforeRequest(mockFilter, request, [], []);

        checkResult(mockFilter, textEncoderUtf8, textDecoderUtf8, testData, '');
    });

    it('checks empty cases - unsupported charset', () => {
        const request = createTestRequest();
        delete request.requestId;

        const mockFilter = new MockStreamFilter();
        const contentFiltering = new ContentFiltering(new MockFilteringLog(), () => {
            return {
                request,
                contentType: 'text/html; charset=koi8-r',
                statusCode: request.statusCode!,
            };
        });

        contentFiltering.onBeforeRequest(mockFilter, request, [], []);

        checkResult(mockFilter, textEncoderUtf8, textDecoderUtf8, testData, '');
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
