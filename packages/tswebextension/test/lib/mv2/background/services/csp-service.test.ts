import {
    describe,
    expect,
    beforeEach,
    it,
} from 'vitest';
import { MatchingResult, RequestType } from '@adguard/tsurlfilter';

import { createNetworkRule } from '../../../../helpers/rule-creator';
import { MockFilteringLog } from '../../../common/mocks/mock-filtering-log';
import { mockEngineApi } from '../../../../helpers/mocks';
import { CspService } from '../../../../../src/lib/mv2/background/services/csp-service';
import { type RequestContext } from '../../../../../src/lib';
import { ContentType } from '../../../../../src/lib/common/request-type';
import { FilteringEventType } from '../../../../../src/lib/common/filtering-log';

describe('Content Security Policy service', () => {
    const mockFilteringLog = new MockFilteringLog();
    const cspService = new CspService(mockFilteringLog, mockEngineApi);

    const getContext = (): RequestContext => {
        return {
            requestUrl: 'https://example.org',
            referrerUrl: 'https://example.org',
            requestType: RequestType.Document,
            contentType: ContentType.Document,
            tabId: 0,
            frameId: 0,
            requestFrameId: 0,
            timestamp: Date.now(),
            thirdParty: false,
            matchingResult: new MatchingResult([], null),
            responseHeaders: [{
                name: 'test_name',
                value: 'test_value',
            }],
        } as RequestContext;
    };

    let context = getContext();

    const runOnHeadersReceived = (): boolean => {
        return cspService.onHeadersReceived(context);
    };

    beforeEach(() => {
        context = getContext();
        mockFilteringLog.publishEvent.mockClear();
    });

    it('correctly applies matching header modifier rules', () => {
        context.matchingResult = new MatchingResult([
            createNetworkRule(String.raw`||example.org^$header=test_name:test_value,csp=frame-src 'none'`, 0),
        ], null);
        const headersModified = runOnHeadersReceived();
        expect(headersModified).toBeTruthy();
        expect(mockFilteringLog.publishEvent).toHaveBeenCalledWith(
            expect.objectContaining({ type: FilteringEventType.ApplyCspRule }),
        );
    });

    it('does not apply non-matching header modifier rules', () => {
        context.matchingResult = new MatchingResult([
            createNetworkRule(String.raw`||example.org^$header=NOT_test_name:test_value,csp=frame-src 'none'`, 0),
        ], null);
        const headersModified = runOnHeadersReceived();
        expect(headersModified).toBeFalsy();
        expect(mockFilteringLog.publishEvent).not.toHaveBeenCalledWith(
            expect.objectContaining({ type: FilteringEventType.ApplyCspRule }),
        );
    });

    it('allowlists rules', () => {
        context.matchingResult = new MatchingResult([
            createNetworkRule('||example.com$csp=style-src *', 0),
            createNetworkRule('@@||example.com$csp=style-src *', 0),
        ], null);
        const hasModified = cspService.onHeadersReceived(context);

        expect(hasModified).toBeFalsy();
        expect(mockFilteringLog.publishEvent).toHaveBeenCalledWith(
            expect.objectContaining({ type: FilteringEventType.ApplyCspRule }),
        );
    });
});
