import {
    beforeEach,
    describe,
    expect,
    it,
    vi,
} from 'vitest';
import { HTTPMethod, RequestType } from '@adguard/tsurlfilter';

import { createCosmeticRule, createNetworkRule } from '../../../../../helpers/rule-creator';
import { RequestContextState } from '../../../../../../src/lib/mv2/background/request/request-context-storage';
import {
    ContentStringFilter,
} from '../../../../../../src/lib/mv2/background/services/content-filtering/content-string-filter';
import { ContentType } from '../../../../../../src/lib/common/request-type';
import { defaultFilteringLog } from '../../../../../../src/lib/common/filtering-log';
import { logger } from '../../../../../../src/lib/common/utils/logger';

vi.mock('../../../../../../src/lib/common/utils/logger');

describe('Content string filter', () => {
    const context = {
        eventId: '1',
        state: RequestContextState.HeadersReceived,
        requestId: '1',
        requestUrl: 'https://example.org',
        referrerUrl: 'https://example.org',
        tabId: 0,
        frameId: 0,
        timestamp: 1643639355148,
        requestType: RequestType.Document,
        method: HTTPMethod.GET,
        status: 200,
        requestFrameId: 0,
        contentType: ContentType.Document,
        thirdParty: false,
    };

    const content = '<html><head></head><body><h1>test</h1><span>test</span></body></html>';

    beforeEach(() => {
        vi.restoreAllMocks();
    });

    it('applies html rules to content', () => {
        const htmlRules = [
            createCosmeticRule('$$h1', 1),
            createCosmeticRule('example.org$$span', 1),
        ];

        const contentStringFilter = new ContentStringFilter(context, htmlRules, null, defaultFilteringLog);

        const modified = contentStringFilter.applyRules(content);

        expect(modified).toBe('<html><head></head><body></body></html>');
    });

    it('applies replace rules to content', () => {
        const replaceRules = [
            createNetworkRule('||example.org^$replace=/test/a/', 1),
            createNetworkRule('||example.org^$replace=/test/b/', 1),
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

    it('ignores invalid or unsupported rules', () => {
        const htmlRules = [
            createCosmeticRule('$$h1', 1),
            createCosmeticRule('example.org$$[href*="http"]', 1),
            // TODO: Add support for `:contains()` (https://github.com/AdguardTeam/AdguardBrowserExtension/issues/3150)
            createCosmeticRule('example.org$$div:contains(foo)', 1),
        ];

        const contentStringFilter = new ContentStringFilter(context, htmlRules, null, defaultFilteringLog);

        const modified = contentStringFilter.applyRules(content);

        expect(logger.info).toHaveBeenCalledWith(
            '[tsweb.ContentStringFilter.applyHtmlRules]: ignoring rule with invalid HTML selector: [href*="http"]',
        );

        expect(logger.info).toHaveBeenCalledWith(
            '[tsweb.ContentStringFilter.applyHtmlRules]: ignoring rule with invalid HTML selector: div:contains(foo)',
        );

        expect(modified).toBe('<html><head></head><body><span>test</span></body></html>');
    });
});
