import {
    describe,
    expect,
    afterEach,
    it,
} from 'vitest';
import {
    MatchingResult,
    RequestType,
    PERMISSIONS_POLICY_HEADER_NAME,
    HTTPMethod,
} from '@adguard/tsurlfilter';

import { createNetworkRule } from '../../../../helpers/rule-creator';
import { MockFilteringLog } from '../../../common/mocks/mock-filtering-log';
import { mockEngineApi } from '../../../../helpers/mocks';
import {
    type RequestContext,
    RequestContextState,
    RequestContextStorage,
} from '../../../../../src/lib/mv2/background/request/request-context-storage';
import { PermissionsPolicyService } from '../../../../../src/lib/mv2/background/services/permissions-policy-service';
import { ContentType } from '../../../../../src/lib/common/request-type';
import { FilteringEventType } from '../../../../../src/lib/common/filtering-log';

describe('Permissions policy service', () => {
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
    const permissionsPolicyService = new PermissionsPolicyService(
        requestContextStorage,
        mockFilteringLog,
        mockEngineApi,
    );

    afterEach(() => {
        mockFilteringLog.publishEvent.mockClear();
        requestContextStorage.clear();
    });

    const getContext = (
        url: string,
        rulesText: string[],
        requestType: RequestType = RequestType.Document,
    ): RequestContext => {
        requestContextStorage.set(requestId, {
            eventId: '1',
            state: RequestContextState.BeforeRequest,
            requestId,
            requestUrl: url,
            referrerUrl: url,
            method: HTTPMethod.GET,
            requestType,
            tabId: 0,
            frameId: 0,
            requestFrameId: 0,
            timestamp: Date.now(),
            thirdParty: false,
            matchingResult: new MatchingResult(rulesText.map(((ruleText) => createNetworkRule(ruleText, 1))), null),
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

    it('allowlist rule should be ignored properly', () => {
        const context = getContext(testUrl, [
            // simple rule should be ignored
            simpleRule,
            `@@${simpleRule}`,
            complexRule,
        ]);

        const result = permissionsPolicyService.onHeadersReceived(context);
        expect(result).toBe(true);
        const { responseHeaders } = requestContextStorage.get(requestId) as RequestContext;
        expect(responseHeaders).toStrictEqual([complexRuleHeaderItem]);
    });

    it('global allowlist for $permissions + $subdocument works properly', () => {
        const context = getContext(testUrl, [
            `||${testUrl}$permissions=autoplay=()`,
            `||${testUrl}$permissions=geolocation=(),subdocument`,
            `@@||${testUrl}$permissions,subdocument`,
        ]);

        const result = permissionsPolicyService.onHeadersReceived(context);
        expect(result).toBe(true);
        const { responseHeaders } = requestContextStorage.get(requestId) as RequestContext;
        expect(responseHeaders).toStrictEqual([{
            name: PERMISSIONS_POLICY_HEADER_NAME,
            value: 'autoplay=()',
        }]);
    });

    it('rule not applied on subdocument request without $subdocument modifier', () => {
        const context = getContext(
            testUrl,
            [simpleRule],
            RequestType.SubDocument,
        );

        const result = permissionsPolicyService.onHeadersReceived(context);
        expect(result).toBe(false);
        const { responseHeaders } = requestContextStorage.get(requestId) as RequestContext;
        expect(responseHeaders).toBeUndefined();
    });

    it('rule not applied on document request with $subdocument modifier', () => {
        const context = getContext(
            testUrl,
            [`${simpleRule},subdocument`],
            RequestType.Document,
        );

        const result = permissionsPolicyService.onHeadersReceived(context);
        expect(result).toBe(false);
        const { responseHeaders } = requestContextStorage.get(requestId) as RequestContext;
        expect(responseHeaders).toBeUndefined();
    });

    it('rule applied on subdocument request with $subdocument modifier', () => {
        const context = getContext(
            testUrl,
            [`${simpleRule},subdocument`],
            RequestType.SubDocument,
        );

        const result = permissionsPolicyService.onHeadersReceived(context);
        expect(result).toBeTruthy();
        const { responseHeaders } = requestContextStorage.get(requestId) as RequestContext;
        expect(responseHeaders).toBeDefined();
        expect(responseHeaders).toContainEqual(simpleRuleHeaderItem);
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
