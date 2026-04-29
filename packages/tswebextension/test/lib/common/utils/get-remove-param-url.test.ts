import {
    describe,
    expect,
    it,
    vi,
} from 'vitest';

import { MatchingResult, RequestType } from '@adguard/tsurlfilter';

import { getRemoveParamUrl } from '../../../../src/lib/common/utils/get-remove-param-url';
import { createNetworkRule } from '../../../helpers/rule-creator';

describe('getRemoveParamUrl', () => {
    const mockMatchRequest = vi.fn();

    const engineApi = { matchRequest: mockMatchRequest };

    const tabContext = {
        info: { url: 'https://example.com' },
        mainFrameRule: null,
    } as any;

    it('returns null when matchingResult is null', () => {
        mockMatchRequest.mockReturnValue(null);
        const result = getRemoveParamUrl('https://example.com?utm=1', tabContext, engineApi);
        expect(result).toBeNull();
    });

    it('returns null when no removeparam rules match', () => {
        mockMatchRequest.mockReturnValue(new MatchingResult([], null));
        const result = getRemoveParamUrl('https://example.com?safe=1', tabContext, engineApi);
        expect(result).toBeNull();
    });

    it('returns purged URL when removeparam rules match', () => {
        const rule = createNetworkRule('||example.com^$removeparam=utm', 1);
        mockMatchRequest.mockReturnValue(new MatchingResult([rule], null));
        const result = getRemoveParamUrl('https://example.com?utm=123&safe=1', tabContext, engineApi);
        expect(result).toBe('https://example.com?safe=1');
    });

    it('returns null when URL does not change after applying rules', () => {
        const rule = createNetworkRule('||example.com^$removeparam=utm', 1);
        mockMatchRequest.mockReturnValue(new MatchingResult([rule], null));
        const result = getRemoveParamUrl('https://example.com?safe=1', tabContext, engineApi);
        expect(result).toBeNull();
    });

    it('removes multiple params when multiple rules match', () => {
        const rule1 = createNetworkRule('||example.com^$removeparam=utm', 1);
        const rule2 = createNetworkRule('||example.com^$removeparam=ysclid', 1);
        mockMatchRequest.mockReturnValue(new MatchingResult([rule1, rule2], null));
        const result = getRemoveParamUrl(
            'https://example.com?utm=123&ysclid=abc&safe=1',
            tabContext,
            engineApi,
        );
        expect(result).toBe('https://example.com?safe=1');
    });

    it('passes correct matchQuery to engineApi', () => {
        mockMatchRequest.mockReturnValue(null);
        const tabCtx = {
            info: { url: 'https://source.com/page' },
            mainFrameRule: null,
        } as any;

        getRemoveParamUrl('https://target.com?q=1', tabCtx, engineApi);

        expect(mockMatchRequest).toHaveBeenCalledWith({
            requestUrl: 'https://target.com?q=1',
            frameUrl: 'https://source.com/page',
            requestType: RequestType.Document,
            frameRule: null,
        });
    });

    it('uses mainFrameRule from tabContext in matchQuery', () => {
        const frameRule = createNetworkRule('@@||example.com^$document', 1);
        const tabCtx = {
            info: { url: 'https://example.com' },
            mainFrameRule: frameRule,
        } as any;
        mockMatchRequest.mockReturnValue(null);

        getRemoveParamUrl('https://example.com?q=1', tabCtx, engineApi);

        expect(mockMatchRequest).toHaveBeenCalledWith(
            expect.objectContaining({ frameRule }),
        );
    });

    it('calls onRuleApplied for blocking rules that change the URL', () => {
        const rule = createNetworkRule('||example.com^$removeparam=utm', 1);
        mockMatchRequest.mockReturnValue(new MatchingResult([rule], null));
        const onRuleApplied = vi.fn();

        getRemoveParamUrl('https://example.com?utm=123&safe=1', tabContext, engineApi, onRuleApplied);

        expect(onRuleApplied).toHaveBeenCalledOnce();
        expect(onRuleApplied).toHaveBeenCalledWith(rule, 'https://example.com?safe=1');
    });

    it('does not call onRuleApplied when blocking rule does not change the URL', () => {
        const rule = createNetworkRule('||example.com^$removeparam=utm', 1);
        mockMatchRequest.mockReturnValue(new MatchingResult([rule], null));
        const onRuleApplied = vi.fn();

        getRemoveParamUrl('https://example.com?safe=1', tabContext, engineApi, onRuleApplied);

        expect(onRuleApplied).not.toHaveBeenCalled();
    });

    it('calls onRuleApplied for allowlist rules with current URL', () => {
        // Create a blocking rule and an allowlist rule with the same param.
        // filterAdvancedModifierRules will replace the blocking rule
        // with the allowlist rule when priorities match.
        const blockingRule = createNetworkRule('||example.com^$removeparam=utm', 1);
        const allowlistRule = createNetworkRule('@@||example.com^$removeparam=utm', 1);
        mockMatchRequest.mockReturnValue(
            new MatchingResult([blockingRule, allowlistRule], null),
        );
        const onRuleApplied = vi.fn();

        // The allowlist rule negates the blocking rule, so the URL stays unchanged.
        const result = getRemoveParamUrl(
            'https://example.com?utm=123&safe=456',
            tabContext,
            engineApi,
            onRuleApplied,
        );

        expect(result).toBeNull();
        // The allowlist rule is called with the unchanged URL.
        expect(onRuleApplied).toHaveBeenCalledOnce();
        expect(onRuleApplied).toHaveBeenCalledWith(
            allowlistRule,
            'https://example.com?utm=123&safe=456',
        );
    });
});
