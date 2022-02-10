import { CosmeticRule, MatchingResult, NetworkRule, RequestType } from '@adguard/tsurlfilter';
import { RequestContextState } from '@lib/mv2/background/request';
import { contentFilter } from '@lib/mv2/background/services/content-filtering/content-filter';

describe('Content filter', () => {

    const context = {
        state: RequestContextState.HEADERS_RECEIVED,
        requestId: '1',
        requestUrl: 'https://example.org',
        referrerUrl: 'https://example.org',
        tabId: 0,
        frameId: 0,
        timestamp: 1643639355148,
        requestType: RequestType.Document,
        method: 'GET',
        status: 200,
    };

    const content = '<html><head></head><body><h1>test</h1><span>test</span></body></html>';

    it('applies html rules to content', () => {
        const rules = [
            new CosmeticRule('$$h1', 1),
            new CosmeticRule('example.org$$span', 1),
        ];

        const modified = contentFilter.applyHtmlRules(content, {
            ...context,
            htmlRules: rules,
        });

        expect(modified).toBe('<html><head></head><body></body></html>');
    });

    it('applies replace rules to content', () => {
        // these rules should be sorted alphabetically
        const rules = [
            new NetworkRule('||example.org^$replace=/test/b/', 1),
            new NetworkRule('||example.org^$replace=/test/a/', 1),
        ];

        const modified = contentFilter.applyReplaceRules(content, {
            ...context,
            matchingResult: new MatchingResult(rules, null),
        });

        expect(modified).toBe('<html><head></head><body><h1>a</h1><span>a</span></body></html>');
    });

    it('returns original content, if request has unsupported content-type header for replace rule', () => {
        const rules = [new NetworkRule('||example.org^$replace=/test/smth/', 1)];

        const modified = contentFilter.applyReplaceRules(content, {
            ...context,
            matchingResult: new MatchingResult(rules, null),
            requestType: RequestType.Other,
            contentTypeHeader: 'multipart/form-data; boundary=something',
        });

        expect(modified).toBe(content);
    });

    it('returns original content, if rules does not exist', () => {
        let modified = contentFilter.applyHtmlRules(content, context);
        modified = contentFilter.applyReplaceRules(content, context);

        expect(modified).toBe(content);
    });
});