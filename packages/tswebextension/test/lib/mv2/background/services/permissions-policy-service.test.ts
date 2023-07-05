import { MatchingResult, NetworkRule, RequestType } from '@adguard/tsurlfilter';

import { PermissionsPolicyService } from '@lib/mv2/background/services/permissions-policy-service';
import { RequestContext, RequestContextState, RequestContextStorage } from '@lib/mv2/background/request';
import { ContentType, FilteringEventType } from '@lib/common';

import { MockFilteringLog } from '../../../common/mocks/mock-filtering-log';

describe('Permissions policy service', () => {
    const PERMISSIONS_POLICY_HEADER_NAME = 'Permissions-Policy';
    const testUrl = 'https://example.org';
    const requestId = '-1';

    const simpleRule = '||example.org$permissions=autoplay=()';
    const simpleRuleHeaderItem = {
        name: PERMISSIONS_POLICY_HEADER_NAME,
        value: 'autoplay=()',
    };
    const complexRule = String.raw`||example.org$permissions=autoplay=(self)\,camera=()`;
    const complexRuleHeaderItem = {
        name: PERMISSIONS_POLICY_HEADER_NAME,
        value: 'autoplay=(self),camera=()',
    };
    const globalAllowlistRule = '@@||example.org$permissions';

    const mockFilteringLog = new MockFilteringLog();
    const requestContextStorage = new RequestContextStorage();
    const permissionsPolicyService = new PermissionsPolicyService(requestContextStorage, mockFilteringLog);

    afterEach(() => {
        mockFilteringLog.publishEvent.mockClear();
        requestContextStorage.clear();
    });

    const getContext = (
        url: string,
        rulesText: string[],
    ): RequestContext => {
        requestContextStorage.set(requestId, {
            state: RequestContextState.BeforeRequest,
            requestId,
            requestUrl: url,
            referrerUrl: url,
            method: 'GET',
            requestType: RequestType.Document,
            tabId: 0,
            frameId: 0,
            requestFrameId: 0,
            timestamp: Date.now(),
            thirdParty: false,
            matchingResult: new MatchingResult(rulesText.map(((ruleText) => new NetworkRule(ruleText, 1))), null),
            contentType: ContentType.Document,
        });

        return requestContextStorage.get(requestId) as RequestContext;
    };

    it('returns false on empty permissionsPolicyRules', () => {
        const context = getContext(testUrl, []);

        const result = permissionsPolicyService.onHeadersReceived(context);
        expect(result).toBe(false);
    });

    it('returns false on global allowlist rule', () => {
        const context = getContext(testUrl, [
            simpleRule,
            complexRule,
            globalAllowlistRule,
        ]);

        const result = permissionsPolicyService.onHeadersReceived(context);
        expect(result).toBe(false);
    });

    it('applies headers from all rules', () => {
        const context = getContext(testUrl, [
            simpleRule,
            complexRule,
        ]);

        const result = permissionsPolicyService.onHeadersReceived(context);
        expect(result).toBe(true);
        const { responseHeaders } = requestContextStorage.get(requestId) as RequestContext;
        expect(responseHeaders).toBeDefined();
        expect(responseHeaders?.find((headerItem) => {
            return headerItem.name === PERMISSIONS_POLICY_HEADER_NAME
                && headerItem.value === simpleRuleHeaderItem.value;
        }));
        expect(responseHeaders?.find((headerItem) => {
            return headerItem.name === PERMISSIONS_POLICY_HEADER_NAME
                && headerItem.value === complexRuleHeaderItem.value;
        }));
    });

    it('updates filtering log', () => {
        const rules = [simpleRule, complexRule];
        const context = getContext(testUrl, rules);

        permissionsPolicyService.onHeadersReceived(context);
        expect(mockFilteringLog.publishEvent).toBeCalledTimes(rules.length);
        expect(mockFilteringLog.publishEvent).toHaveBeenCalledWith(
            expect.objectContaining({
                type: FilteringEventType.ApplyPermissionsRule,
            }),
        );
    });
});
