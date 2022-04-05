import {
    CosmeticRule,
    NetworkRule,
    RequestType,
} from '@adguard/tsurlfilter';
import { RequestContextState } from '@lib/mv2/background/request';
import { ContentStringFilter } from '@lib/mv2/background/services/content-filtering/content-string-filter';
import { defaultFilteringLog } from '@lib/common';

describe('Content string filter', () => {
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
        const htmlRules = [
            new CosmeticRule('$$h1', 1),
            new CosmeticRule('example.org$$span', 1),
        ];

        const contentStringFilter = new ContentStringFilter(context, htmlRules, null, defaultFilteringLog);

        const modified = contentStringFilter.applyRules(content);

        expect(modified).toBe('<html><head></head><body></body></html>');
    });

    it('applies replace rules to content', () => {
        const replaceRules = [
            new NetworkRule('||example.org^$replace=/test/a/', 1),
            new NetworkRule('||example.org^$replace=/test/b/', 1),
        ];

        const contentStringFilter = new ContentStringFilter(context, null, replaceRules, defaultFilteringLog);

        const modified = contentStringFilter.applyRules(content);

        expect(modified).toBe('<html><head></head><body><h1>a</h1><span>a</span></body></html>');
    });

    it('returns original content, if rules does not exist', () => {
        const contentStringFilter = new ContentStringFilter(context, null, null, defaultFilteringLog);

        const modified = contentStringFilter.applyRules(content);

        expect(modified).toBe(content);
    });
});
