import {
    describe,
    expect,
    it,
    type Mock,
    vi,
} from 'vitest';
import browser from 'webextension-polyfill';

import { type IRulesetWithSourceMap, TooManyRulesError, TooManyUnsafeRulesError } from '@adguard/dnr-converter';

import {
    ALLOWLIST_FILTER_ID,
    BLOCKING_TRUSTED_FILTER_ID,
    CUSTOM_FILTERS_START_ID,
    USER_FILTER_ID,
} from '../../../../src/lib/common/constants';
import { CspRulesManager } from '../../../../src/lib/mv3/background/csp-rules-manager';
import DynamicRulesApi, { type DynamicRulesSnapshot } from '../../../../src/lib/mv3/background/dynamic-rules-api';
import { createFilter } from '../helpers';

/**
 * Overrides for the mocked DNR quota limits.
 */
type CspQuotaLimits = {
    /**
     * Maximum number of dynamic rules.
     */
    maxNumberOfDynamicRules?: number;

    /**
     * Maximum number of unsafe dynamic rules.
     */
    maxNumberOfUnsafeDynamicRules?: number;

    /**
     * Maximum number of regexp rules.
     */
    maxNumberOfRegexpRules?: number;
};

/**
 * Mocked DNR API.
 */
type DnrApiMock = {
    /**
     * Returns current dynamic rules.
     */
    getDynamicRules: Mock;

    /**
     * Updates dynamic rules.
     */
    updateDynamicRules: Mock;

    /**
     * Maximum number of unsafe dynamic rules.
     */
    MAX_NUMBER_OF_UNSAFE_DYNAMIC_RULES: number;

    /**
     * Maximum number of dynamic rules.
     */
    MAX_NUMBER_OF_DYNAMIC_RULES: number;

    /**
     * Maximum number of regexp rules.
     */
    MAX_NUMBER_OF_REGEX_RULES: number;
};

/**
 * Prepared conversion results and the DNR API mock.
 */
type CspConversion = {
    /**
     * Mocked DNR API.
     */
    mockDeclarativeNetRequest: DnrApiMock;

    /**
     * Dynamic rules conversion result.
     */
    conversionResult: Awaited<ReturnType<typeof DynamicRulesApi.prepareDynamicFiltering>>;

    /**
     * Rebuilt CSP rules conversion result.
     */
    cspResult: Awaited<ReturnType<typeof CspRulesManager.build>>;
};

/**
 * Mocks the DNR APIs and prepares the dynamic rules and rebuilt CSP rules
 * conversion results for the given user rules.
 *
 * @param userRules User rules to convert.
 * @param limits Overrides for the mocked DNR quota limits.
 *
 * @returns DNR API mock and prepared conversion results.
 */
const prepareCspConversion = async (
    userRules: string[],
    limits: CspQuotaLimits = {},
): Promise<CspConversion> => {
    const mockDeclarativeNetRequest: DnrApiMock = {
        getDynamicRules: vi.fn().mockResolvedValue([{ id: 100 }]),
        updateDynamicRules: vi.fn().mockResolvedValue({}),
        MAX_NUMBER_OF_UNSAFE_DYNAMIC_RULES: limits.maxNumberOfUnsafeDynamicRules ?? 10,
        MAX_NUMBER_OF_DYNAMIC_RULES: limits.maxNumberOfDynamicRules ?? 10,
        MAX_NUMBER_OF_REGEX_RULES: limits.maxNumberOfRegexpRules ?? 10,
    };

    // @ts-expect-error(2540)
    browser.declarativeNetRequest = mockDeclarativeNetRequest;
    // @ts-expect-error(2740)
    chrome.declarativeNetRequest = mockDeclarativeNetRequest;

    const userFilter = createFilter(userRules, USER_FILTER_ID);
    const conversionResult = await DynamicRulesApi.prepareDynamicFiltering(
        createFilter([], ALLOWLIST_FILTER_ID),
        createFilter([], BLOCKING_TRUSTED_FILTER_ID),
        userFilter,
        [],
        [],
        undefined,
        true,
    );
    const cspResult = await CspRulesManager.build([], [userFilter]);

    return {
        mockDeclarativeNetRequest,
        conversionResult,
        cspResult,
    };
};

describe('DynamicRulesApi', () => {
    describe('updateDynamicFiltering', () => {
        // eslint-disable-next-line max-len
        it('prioritizes rules in next order: allowlist -> trusted domains exceptions -> userrules -> custom filters', async () => {
            // Manually create the mock structure for browser.declarativeNetRequest
            const mockDeclarativeNetRequest = {
                getDynamicRules: vi.fn().mockResolvedValue([]),
                updateDynamicRules: vi.fn().mockResolvedValue({}),
                MAX_NUMBER_OF_UNSAFE_DYNAMIC_RULES: 0,
                MAX_NUMBER_OF_DYNAMIC_RULES: 1,
                MAX_NUMBER_OF_REGEX_RULES: 0,
            };

            // Override the browser object with the mock
            // @ts-expect-error(2540)
            browser.declarativeNetRequest = mockDeclarativeNetRequest;
            // MAX_NUMBER_OF_UNSAFE_DYNAMIC_RULES is used directly from chrome
            // namespace.
            // @ts-expect-error(2740)
            chrome.declarativeNetRequest = mockDeclarativeNetRequest;

            const userRule = 'example.org';
            const allowlistRule = '@@$document,to=example.org';
            const trustedDomainsException = '@@$document,to=example123.com';
            const customRule = 'example.com';

            mockDeclarativeNetRequest.MAX_NUMBER_OF_DYNAMIC_RULES = 1;

            let conversionResult = await DynamicRulesApi.updateDynamicFiltering(
                createFilter([allowlistRule], ALLOWLIST_FILTER_ID),
                createFilter([trustedDomainsException], BLOCKING_TRUSTED_FILTER_ID),
                createFilter([userRule], USER_FILTER_ID),
                [createFilter([customRule], CUSTOM_FILTERS_START_ID)],
                [],
            );

            let declarativeRules = await conversionResult.ruleset.getDeclarativeRules();
            expect(declarativeRules).toHaveLength(1);
            expect(declarativeRules[0].action.type).toBe('allowAllRequests');
            expect(declarativeRules[0].condition.requestDomains![0]).toBe('example.org');

            mockDeclarativeNetRequest.MAX_NUMBER_OF_DYNAMIC_RULES = 2;

            conversionResult = await DynamicRulesApi.updateDynamicFiltering(
                createFilter([allowlistRule], ALLOWLIST_FILTER_ID),
                createFilter([], BLOCKING_TRUSTED_FILTER_ID),
                createFilter([userRule], USER_FILTER_ID),
                [createFilter([customRule], CUSTOM_FILTERS_START_ID)],
                [],
            );

            declarativeRules = await conversionResult.ruleset.getDeclarativeRules();

            expect(declarativeRules).toHaveLength(2);
            expect(declarativeRules[0].action.type).toBe('allowAllRequests');
            expect(declarativeRules[0].condition.requestDomains![0]).toBe('example.org');
            expect(declarativeRules[1].condition.urlFilter).toBe('example.org');

            // same as previous but with trusted domains exception
            conversionResult = await DynamicRulesApi.updateDynamicFiltering(
                createFilter([allowlistRule], ALLOWLIST_FILTER_ID),
                createFilter([trustedDomainsException], BLOCKING_TRUSTED_FILTER_ID),
                createFilter([userRule], USER_FILTER_ID),
                [createFilter([customRule], CUSTOM_FILTERS_START_ID)],
                [],
            );

            declarativeRules = await conversionResult.ruleset.getDeclarativeRules();

            expect(declarativeRules).toHaveLength(2);
            expect(declarativeRules[0].action.type).toBe('allowAllRequests');
            expect(declarativeRules[0].condition.requestDomains![0]).toBe('example.org');
            // trusted domains exception is prioritized over user rules
            expect(declarativeRules[1].action.type).toBe('allowAllRequests');
            expect(declarativeRules[1].condition.requestDomains![0]).toBe('example123.com');

            mockDeclarativeNetRequest.MAX_NUMBER_OF_DYNAMIC_RULES = 3;

            conversionResult = await DynamicRulesApi.updateDynamicFiltering(
                createFilter([allowlistRule], ALLOWLIST_FILTER_ID),
                createFilter([], BLOCKING_TRUSTED_FILTER_ID),
                createFilter([userRule], USER_FILTER_ID),
                [createFilter([customRule], CUSTOM_FILTERS_START_ID)],
                [],
            );

            declarativeRules = await conversionResult.ruleset.getDeclarativeRules();

            expect(declarativeRules).toHaveLength(3);
            expect(declarativeRules[0].action.type).toBe('allowAllRequests');
            expect(declarativeRules[0].condition.requestDomains![0]).toBe('example.org');
            expect(declarativeRules[1].condition.urlFilter).toBe('example.org');
            expect(declarativeRules[2].condition.urlFilter).toBe('example.com');

            mockDeclarativeNetRequest.MAX_NUMBER_OF_DYNAMIC_RULES = 4;

            conversionResult = await DynamicRulesApi.updateDynamicFiltering(
                createFilter([allowlistRule], ALLOWLIST_FILTER_ID),
                createFilter([trustedDomainsException], BLOCKING_TRUSTED_FILTER_ID),
                createFilter([userRule], USER_FILTER_ID),
                [createFilter([customRule], CUSTOM_FILTERS_START_ID)],
                [],
            );

            declarativeRules = await conversionResult.ruleset.getDeclarativeRules();

            expect(declarativeRules).toHaveLength(4);
            expect(declarativeRules[0].action.type).toBe('allowAllRequests');
            expect(declarativeRules[0].condition.requestDomains![0]).toBe('example.org');
            expect(declarativeRules[1].action.type).toBe('allowAllRequests');
            expect(declarativeRules[1].condition.requestDomains![0]).toBe('example123.com');
            expect(declarativeRules[2].condition.urlFilter).toBe('example.org');
            expect(declarativeRules[3].condition.urlFilter).toBe('example.com');

            // Clean up the mock after the test
            // @ts-ignore
            delete browser.declarativeNetRequest;
        });

        // eslint-disable-next-line max-len
        it('preserves ruleset metadata across unloadContent() and re-convert (AG-45668 regression test)', async () => {
            // Manually create the mock structure for browser.declarativeNetRequest
            const mockDeclarativeNetRequest = {
                getDynamicRules: vi.fn().mockResolvedValue([]),
                updateDynamicRules: vi.fn().mockResolvedValue({}),
                MAX_NUMBER_OF_UNSAFE_DYNAMIC_RULES: 0,
                MAX_NUMBER_OF_DYNAMIC_RULES: 10,
                MAX_NUMBER_OF_REGEX_RULES: 0,
            };

            // Override the browser object with the mock
            // @ts-expect-error(2540)
            browser.declarativeNetRequest = mockDeclarativeNetRequest;
            // MAX_NUMBER_OF_UNSAFE_DYNAMIC_RULES is used directly from chrome
            // namespace.
            // @ts-expect-error(2740)
            chrome.declarativeNetRequest = mockDeclarativeNetRequest;

            // `||example.net^` / `||example.com^` are convertible network rules
            // that populate the rules hash map; `||example.org^$badfilter`
            // populates `badFilterRules`.
            const userRules = [
                '||example.net^',
                '||example.com^',
                '||example.org^$badfilter',
            ];

            const { ruleset } = await DynamicRulesApi.updateDynamicFiltering(
                createFilter([], ALLOWLIST_FILTER_ID),
                createFilter([], BLOCKING_TRUSTED_FILTER_ID),
                createFilter(userRules, USER_FILTER_ID),
                [],
                [],
            );

            // Metadata must be populated right after conversion.
            expect(ruleset.getBadFilterRules()).not.toHaveLength(0);
            expect(ruleset.getRulesHashMap().serialize()).not.toBe('[]');

            // `unloadContent()` is the end-of-`configure()` cleanup invoked when
            // `declarativeLogEnabled` is false (see app.ts). It unloads the
            // source map / filter list / declarative rules but MUST NOT clear
            // the in-memory metadata (previously a separate `unloadMetadata()`
            // did, which returned empty metadata on a subsequent `configure()`).
            ruleset.unloadContent();

            expect(ruleset.getBadFilterRules()).not.toHaveLength(0);
            expect(ruleset.getRulesHashMap().serialize()).not.toBe('[]');

            // A second conversion mirrors a re-`configure()` and must again
            // produce non-empty metadata on the fresh ruleset.
            const secondResult = await DynamicRulesApi.updateDynamicFiltering(
                createFilter([], ALLOWLIST_FILTER_ID),
                createFilter([], BLOCKING_TRUSTED_FILTER_ID),
                createFilter(userRules, USER_FILTER_ID),
                [],
                [],
            );

            expect(secondResult.ruleset.getBadFilterRules()).not.toHaveLength(0);
            expect(secondResult.ruleset.getRulesHashMap().serialize()).not.toBe('[]');

            // Clean up the mock after the test
            // @ts-ignore
            delete browser.declarativeNetRequest;
        });

        it('atomically replaces separately rebuilt CSP rules', async () => {
            const {
                mockDeclarativeNetRequest,
                conversionResult,
                cspResult,
            } = await prepareCspConversion([
                '||ads.example^',
                "||example.com^$csp=script-src 'none'",
            ]);

            await DynamicRulesApi.applyDynamicFiltering(
                conversionResult,
                [],
                cspResult.dynamicRules,
                cspResult.ruleset,
            );

            expect(mockDeclarativeNetRequest.updateDynamicRules).toHaveBeenCalledTimes(1);
            const [update] = mockDeclarativeNetRequest.updateDynamicRules.mock.calls[0];
            expect(update.removeRuleIds).toEqual([100]);
            expect(update.addRules).toHaveLength(2);
            expect(update.addRules.map((rule: chrome.declarativeNetRequest.Rule) => rule.action.type))
                .toEqual(['block', 'modifyHeaders']);
            expect(DynamicRulesApi.sourceMapForCspRules.size).toBe(1);

            // @ts-ignore
            delete browser.declarativeNetRequest;
        });

        it('omits rebuilt CSP rules that exceed the dynamic limit', async () => {
            const {
                mockDeclarativeNetRequest,
                conversionResult,
                cspResult,
            } = await prepareCspConversion(
                [
                    '||ads.example^',
                    "||example.com^$csp=script-src 'none'",
                ],
                { maxNumberOfDynamicRules: 1 },
            );

            const limitedCspRules = DynamicRulesApi.limitRebuiltCspRules(
                conversionResult,
                cspResult.dynamicRules,
            );

            await DynamicRulesApi.applyDynamicFiltering(
                conversionResult,
                [],
                limitedCspRules.rules,
                cspResult.ruleset,
            );

            expect(limitedCspRules.rules).toEqual([]);
            expect(limitedCspRules.limitations).toHaveLength(1);
            expect(limitedCspRules.limitations[0]).toBeInstanceOf(TooManyRulesError);
            expect((limitedCspRules.limitations[0] as TooManyRulesError).excludedRulesIds)
                .toEqual([cspResult.dynamicRules[0].id]);
            expect(limitedCspRules.counts).toEqual({ total: 1, unsafe: 0, regexp: 0 });
            expect(mockDeclarativeNetRequest.updateDynamicRules).toHaveBeenCalledWith({
                removeRuleIds: [100],
                addRules: [expect.objectContaining({ action: { type: 'block' } })],
            });

            // @ts-ignore
            delete browser.declarativeNetRequest;
        });

        it('omits rebuilt CSP rules that exceed the unsafe dynamic limit', async () => {
            const { conversionResult, cspResult } = await prepareCspConversion(
                [
                    '||ads.example^',
                    "||example.com^$csp=script-src 'none'",
                ],
                { maxNumberOfUnsafeDynamicRules: 0 },
            );

            const limitedCspRules = DynamicRulesApi.limitRebuiltCspRules(
                conversionResult,
                cspResult.dynamicRules,
            );

            expect(limitedCspRules.rules).toEqual([]);
            expect(limitedCspRules.limitations).toHaveLength(1);
            expect(limitedCspRules.limitations[0]).toBeInstanceOf(TooManyUnsafeRulesError);
            expect((limitedCspRules.limitations[0] as TooManyUnsafeRulesError).excludedRulesIds)
                .toEqual([cspResult.dynamicRules[0].id]);
            expect(limitedCspRules.counts).toEqual({ total: 1, unsafe: 0, regexp: 0 });

            // @ts-ignore
            delete browser.declarativeNetRequest;
        });

        it('counts rebuilt CSP rules in the final dynamic counts', async () => {
            const { conversionResult, cspResult } = await prepareCspConversion(
                [
                    '||ads.example^',
                    "||example.com^$csp=script-src 'none'",
                ],
            );

            const limitedCspRules = DynamicRulesApi.limitRebuiltCspRules(
                conversionResult,
                cspResult.dynamicRules,
            );

            expect(limitedCspRules.rules).toEqual(cspResult.dynamicRules);
            expect(limitedCspRules.limitations).toEqual([]);
            expect(limitedCspRules.counts).toEqual({ total: 2, unsafe: 1, regexp: 0 });

            // @ts-ignore
            delete browser.declarativeNetRequest;
        });

        it('omits rebuilt CSP rules that exceed the limit instead of failing', async () => {
            const {
                mockDeclarativeNetRequest,
                conversionResult,
                cspResult,
            } = await prepareCspConversion(
                [
                    '||ads.example^',
                    "||example.com^$csp=script-src 'none'",
                ],
                { maxNumberOfDynamicRules: 1 },
            );

            // Rebuilt CSP rules are passed without pre-limiting on purpose: the
            // merge must fit them into the quota instead of failing the apply.
            await expect(DynamicRulesApi.applyDynamicFiltering(
                conversionResult,
                [],
                cspResult.dynamicRules,
                cspResult.ruleset,
            )).resolves.toBeDefined();

            expect(mockDeclarativeNetRequest.updateDynamicRules).toHaveBeenCalledWith({
                removeRuleIds: [100],
                addRules: [expect.objectContaining({ action: { type: 'block' } })],
            });

            // @ts-ignore
            delete browser.declarativeNetRequest;
        });

        it('restores dynamic rules and CSP source map from a snapshot', async () => {
            const mockDeclarativeNetRequest = {
                getDynamicRules: vi.fn()
                    .mockResolvedValueOnce([{ id: 100 }])
                    .mockResolvedValueOnce([{ id: 200 }]),
                getDisabledRuleIds: vi.fn()
                    .mockResolvedValueOnce([10])
                    .mockResolvedValueOnce([10])
                    .mockResolvedValueOnce([20]),
                updateDynamicRules: vi.fn().mockResolvedValue(undefined),
                updateStaticRules: vi.fn().mockResolvedValue(undefined),
                MAX_NUMBER_OF_UNSAFE_DYNAMIC_RULES: 10,
                MAX_NUMBER_OF_DYNAMIC_RULES: 10,
                MAX_NUMBER_OF_REGEX_RULES: 10,
            };

            // @ts-expect-error(2540)
            browser.declarativeNetRequest = mockDeclarativeNetRequest;
            // @ts-expect-error(2740)
            chrome.declarativeNetRequest = mockDeclarativeNetRequest;

            DynamicRulesApi.sourceMapForCspRules.set(100, ['old', 1]);
            const userFilter = createFilter(['||ads.example^'], USER_FILTER_ID);
            const conversionResult = await DynamicRulesApi.prepareDynamicFiltering(
                createFilter([], ALLOWLIST_FILTER_ID),
                createFilter([], BLOCKING_TRUSTED_FILTER_ID),
                userFilter,
                [],
                [],
            );
            const snapshot = await DynamicRulesApi.applyDynamicFiltering(
                conversionResult,
                [{ getId: () => 'ruleset_1' } as IRulesetWithSourceMap],
            );
            DynamicRulesApi.sourceMapForCspRules.clear();

            await DynamicRulesApi.rollbackDynamicFiltering(snapshot);

            expect(mockDeclarativeNetRequest.updateDynamicRules).toHaveBeenLastCalledWith({
                removeRuleIds: [200],
                addRules: [{ id: 100 }],
            });
            expect(mockDeclarativeNetRequest.updateStaticRules).toHaveBeenLastCalledWith({
                rulesetId: 'ruleset_1',
                enableRuleIds: [20],
                disableRuleIds: [10],
            });
            expect(DynamicRulesApi.sourceMapForCspRules.get(100)).toEqual(['old', 1]);

            // @ts-ignore
            delete browser.declarativeNetRequest;
        });

        it('restores dynamic rules even when a static ruleset restore fails', async () => {
            const mockDeclarativeNetRequest = {
                getDynamicRules: vi.fn().mockResolvedValue([{ id: 200 }]),
                updateDynamicRules: vi.fn().mockResolvedValue(undefined),
                getDisabledRuleIds: vi.fn()
                    .mockResolvedValueOnce([10])
                    .mockResolvedValueOnce([30]),
                updateStaticRules: vi.fn()
                    .mockRejectedValueOnce(new Error('first ruleset failed'))
                    .mockResolvedValueOnce(undefined),
                MAX_NUMBER_OF_UNSAFE_DYNAMIC_RULES: 10,
                MAX_NUMBER_OF_DYNAMIC_RULES: 10,
                MAX_NUMBER_OF_REGEX_RULES: 10,
            };

            // @ts-expect-error(2540)
            browser.declarativeNetRequest = mockDeclarativeNetRequest;
            // @ts-expect-error(2740)
            chrome.declarativeNetRequest = mockDeclarativeNetRequest;

            const snapshot: DynamicRulesSnapshot = {
                rules: [{ id: 100 }] as browser.DeclarativeNetRequest.Rule[],
                sourceMap: new Map([[100, ['_csp', 1]]]),
                disabledStaticRuleIds: new Map([
                    ['ruleset_1', [10]],
                    ['ruleset_2', [30]],
                ]),
            };

            await expect(DynamicRulesApi.rollbackDynamicFiltering(snapshot)).resolves.toBeUndefined();

            expect(mockDeclarativeNetRequest.updateDynamicRules).toHaveBeenCalledWith({
                removeRuleIds: [200],
                addRules: [{ id: 100 }],
            });
            expect(mockDeclarativeNetRequest.updateStaticRules).toHaveBeenCalledTimes(2);
            expect(DynamicRulesApi.sourceMapForCspRules.get(100)).toEqual(['_csp', 1]);

            // @ts-ignore
            delete browser.declarativeNetRequest;
        });
    });
});
