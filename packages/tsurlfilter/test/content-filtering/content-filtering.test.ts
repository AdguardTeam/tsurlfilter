/**
 * @jest-environment jsdom
 */

import { TextDecoder, TextEncoder } from 'text-encoding';
import { MockStreamFilter } from './mock-stream-filter';
import {
    ContentFiltering, IRule, NetworkRule, RequestType,
} from '../../src';
import { CosmeticRule } from '../../src/rules/cosmetic-rule';
import { ModificationsListener } from '../../src/content-filtering/modifications-listener';
import { RequestContext } from '../../src/content-filtering/request-context';

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

const createTestRequest = (requestType?: RequestType): RequestContext => {
    return {
        requestId: '1',
        requestUrl: 'https://example.org',
        engineRequestType: requestType ? requestType! : RequestType.Document,
        contentType: 'text/html',
        statusCode: 200,
        method: 'GET',
        tab: {
            tabId: 1,
        },
    };
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
        const contentFiltering = new ContentFiltering(new MockFilteringLog());

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
        const contentFiltering = new ContentFiltering(new MockFilteringLog());

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
        const contentFiltering = new ContentFiltering(new MockFilteringLog());

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
        const contentFiltering = new ContentFiltering(new MockFilteringLog());

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
        const contentFiltering = new ContentFiltering(new MockFilteringLog());

        contentFiltering.onBeforeRequest(mockFilter, request, [], []);

        checkResult(mockFilter, textEncoderUtf8, textDecoderUtf8, testData, '');
    });

    it('checks empty cases - status code', () => {
        const request = createTestRequest();
        request.statusCode = 304;

        const mockFilter = new MockStreamFilter();
        const contentFiltering = new ContentFiltering(new MockFilteringLog());

        contentFiltering.onBeforeRequest(mockFilter, request, [], []);

        checkResult(mockFilter, textEncoderUtf8, textDecoderUtf8, testData, '');
    });

    it('checks empty cases - method', () => {
        const request = createTestRequest();
        request.method = 'PUT';

        const mockFilter = new MockStreamFilter();
        const contentFiltering = new ContentFiltering(new MockFilteringLog());

        contentFiltering.onBeforeRequest(mockFilter, request, [], []);

        checkResult(mockFilter, textEncoderUtf8, textDecoderUtf8, testData, '');
    });

    it('checks empty cases - requestId', () => {
        const request = createTestRequest() as Partial<RequestContext>;
        delete request.requestId;

        const mockFilter = new MockStreamFilter();
        const contentFiltering = new ContentFiltering(new MockFilteringLog());

        contentFiltering.onBeforeRequest(mockFilter, request as RequestContext, [], []);

        checkResult(mockFilter, textEncoderUtf8, textDecoderUtf8, testData, '');
    });

    it('checks empty cases - unsupported charset', () => {
        const request = createTestRequest() as Partial<RequestContext>;
        delete request.requestId;

        const mockFilter = new MockStreamFilter();
        const contentFiltering = new ContentFiltering(new MockFilteringLog());

        contentFiltering.onBeforeRequest(mockFilter, request as RequestContext, [], []);

        checkResult(mockFilter, textEncoderUtf8, textDecoderUtf8, testData, '');
    });
});
