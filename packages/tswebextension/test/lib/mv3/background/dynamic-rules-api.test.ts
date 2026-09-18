import {
    describe,
    expect,
    it,
    vi,
} from 'vitest';
import browser from 'webextension-polyfill';

import { type IRulesetWithSourceMap, TooManyUnsafeRulesError } from '@adguard/dnr-converter';

import {
    ALLOWLIST_FILTER_ID,
    BLOCKING_TRUSTED_FILTER_ID,
    CUSTOM_FILTERS_START_ID,
    USER_FILTER_ID,
} from '../../../../src/lib/common/constants';
import { CspRulesManager } from '../../../../src/lib/mv3/background/csp-rules-manager';
import DynamicRulesApi from '../../../../src/lib/mv3/background/dynamic-rules-api';
import { createFilter } from '../helpers';

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
            const mockDeclarativeNetRequest = {
                getDynamicRules: vi.fn().mockResolvedValue([{ id: 100 }]),
                updateDynamicRules: vi.fn().mockResolvedValue({}),
                MAX_NUMBER_OF_UNSAFE_DYNAMIC_RULES: 10,
                MAX_NUMBER_OF_DYNAMIC_RULES: 10,
                MAX_NUMBER_OF_REGEX_RULES: 10,
            };

            // @ts-expect-error(2540)
            browser.declarativeNetRequest = mockDeclarativeNetRequest;
            // @ts-expect-error(2740)
            chrome.declarativeNetRequest = mockDeclarativeNetRequest;

            const userFilter = createFilter([
                '||ads.example^',
                "||example.com^$csp=script-src 'none'",
            ], USER_FILTER_ID);
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
            const mockDeclarativeNetRequest = {
                getDynamicRules: vi.fn().mockResolvedValue([{ id: 100 }]),
                updateDynamicRules: vi.fn().mockResolvedValue({}),
                MAX_NUMBER_OF_UNSAFE_DYNAMIC_RULES: 1,
                MAX_NUMBER_OF_DYNAMIC_RULES: 1,
                MAX_NUMBER_OF_REGEX_RULES: 10,
            };

            // @ts-expect-error(2540)
            browser.declarativeNetRequest = mockDeclarativeNetRequest;
            // @ts-expect-error(2740)
            chrome.declarativeNetRequest = mockDeclarativeNetRequest;

            const userFilter = createFilter([
                '||ads.example^',
                "||example.com^$csp=script-src 'none'",
            ], USER_FILTER_ID);
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
            expect(mockDeclarativeNetRequest.updateDynamicRules).toHaveBeenCalledWith({
                removeRuleIds: [100],
                addRules: [expect.objectContaining({ action: { type: 'block' } })],
            });

            // @ts-ignore
            delete browser.declarativeNetRequest;
        });

        it('omits rebuilt CSP rules that exceed the unsafe dynamic limit', async () => {
            const mockDeclarativeNetRequest = {
                getDynamicRules: vi.fn().mockResolvedValue([{ id: 100 }]),
                updateDynamicRules: vi.fn().mockResolvedValue({}),
                MAX_NUMBER_OF_UNSAFE_DYNAMIC_RULES: 0,
                MAX_NUMBER_OF_DYNAMIC_RULES: 10,
                MAX_NUMBER_OF_REGEX_RULES: 10,
            };

            // @ts-expect-error(2540)
            browser.declarativeNetRequest = mockDeclarativeNetRequest;
            // @ts-expect-error(2740)
            chrome.declarativeNetRequest = mockDeclarativeNetRequest;

            const userFilter = createFilter([
                '||ads.example^',
                "||example.com^$csp=script-src 'none'",
            ], USER_FILTER_ID);
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
            const limitedCspRules = DynamicRulesApi.limitRebuiltCspRules(
                conversionResult,
                cspResult.dynamicRules,
            );

            expect(limitedCspRules.rules).toEqual([]);
            expect(limitedCspRules.limitations).toHaveLength(1);
            expect(limitedCspRules.limitations[0]).toBeInstanceOf(TooManyUnsafeRulesError);

            // @ts-ignore
            delete browser.declarativeNetRequest;
        });

        it('omits rebuilt CSP rules that exceed the limit instead of failing', async () => {
            const mockDeclarativeNetRequest = {
                getDynamicRules: vi.fn().mockResolvedValue([{ id: 100 }]),
                updateDynamicRules: vi.fn().mockResolvedValue({}),
                MAX_NUMBER_OF_UNSAFE_DYNAMIC_RULES: 10,
                MAX_NUMBER_OF_DYNAMIC_RULES: 1,
                MAX_NUMBER_OF_REGEX_RULES: 10,
            };

            // @ts-expect-error(2540)
            browser.declarativeNetRequest = mockDeclarativeNetRequest;
            // @ts-expect-error(2740)
            chrome.declarativeNetRequest = mockDeclarativeNetRequest;

            const userFilter = createFilter([
                '||ads.example^',
                "||example.com^$csp=script-src 'none'",
            ], USER_FILTER_ID);
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

            const snapshot = {
                rules: [{ id: 100 }],
                sourceMap: new Map([[100, ['_csp', 1]]]),
                disabledStaticRuleIds: new Map([
                    ['ruleset_1', [10]],
                    ['ruleset_2', [30]],
                ]),
            };

            await expect(DynamicRulesApi.rollbackDynamicFiltering(snapshot as any)).resolves.toBeUndefined();

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
