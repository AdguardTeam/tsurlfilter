import {
    beforeEach,
    describe,
    expect,
    it,
    vi,
} from 'vitest';
import browser from 'webextension-polyfill';

import { RULESET_NAME_PREFIX } from '@adguard/tsurlfilter/es/declarative-converter';

import FiltersApi from '../../../../src/lib/mv3/background/filters-api';
import { FailedEnableRuleSetsError } from '../../../../src/lib/mv3/errors/failed-enable-rule-sets-error';

describe('FiltersApi', () => {
    let mockUpdateEnabledRulesets: ReturnType<typeof vi.fn>;

    beforeEach(() => {
        mockUpdateEnabledRulesets = vi.fn().mockResolvedValue(undefined);

        // @ts-expect-error(2540)
        browser.declarativeNetRequest = {
            ...browser.declarativeNetRequest,
            updateEnabledRulesets: mockUpdateEnabledRulesets,
        };
    });

    describe('updateFiltering - one-by-one enabling', () => {
        it('enables all rulesets successfully with no errors', async () => {
            const result = await FiltersApi.updateFiltering([], [1, 2, 3]);

            expect(result.errors).toHaveLength(0);
            // 3 individual enable calls (one per ruleset)
            expect(mockUpdateEnabledRulesets).toHaveBeenCalledTimes(3);
            expect(mockUpdateEnabledRulesets).toHaveBeenCalledWith({
                enableRulesetIds: [`${RULESET_NAME_PREFIX}1`],
            });
            expect(mockUpdateEnabledRulesets).toHaveBeenCalledWith({
                enableRulesetIds: [`${RULESET_NAME_PREFIX}2`],
            });
            expect(mockUpdateEnabledRulesets).toHaveBeenCalledWith({
                enableRulesetIds: [`${RULESET_NAME_PREFIX}3`],
            });
        });

        it('collects error for one failed ruleset while enabling others', async () => {
            const testError = new Error('Ruleset not found');
            mockUpdateEnabledRulesets
                .mockResolvedValueOnce(undefined) // filter 1 succeeds
                .mockRejectedValueOnce(testError) // filter 2 fails
                .mockResolvedValueOnce(undefined); // filter 3 succeeds

            const result = await FiltersApi.updateFiltering([], [1, 2, 3]);

            expect(result.errors).toHaveLength(1);
            expect(result.errors[0]).toBeInstanceOf(FailedEnableRuleSetsError);
            expect(result.errors[0].enableRulesetIds).toEqual([`${RULESET_NAME_PREFIX}2`]);
            expect(result.errors[0].disableRulesetIds).toEqual([]);
            expect(result.errors[0].cause).toBe(testError);
            // All 3 enable calls were still attempted
            expect(mockUpdateEnabledRulesets).toHaveBeenCalledTimes(3);
        });

        it('collects errors when all rulesets fail', async () => {
            const testError = new Error('Ruleset not found');
            mockUpdateEnabledRulesets.mockRejectedValue(testError);

            const result = await FiltersApi.updateFiltering([], [1, 2, 3]);

            expect(result.errors).toHaveLength(3);
            result.errors.forEach((err) => {
                expect(err).toBeInstanceOf(FailedEnableRuleSetsError);
                expect(err.disableRulesetIds).toEqual([]);
            });
            expect(result.errors[0].enableRulesetIds).toEqual([`${RULESET_NAME_PREFIX}1`]);
            expect(result.errors[1].enableRulesetIds).toEqual([`${RULESET_NAME_PREFIX}2`]);
            expect(result.errors[2].enableRulesetIds).toEqual([`${RULESET_NAME_PREFIX}3`]);
        });

        it('applies disables in a single call with no enable calls', async () => {
            const result = await FiltersApi.updateFiltering([1, 2], []);

            expect(result.errors).toHaveLength(0);
            expect(mockUpdateEnabledRulesets).toHaveBeenCalledTimes(1);
            expect(mockUpdateEnabledRulesets).toHaveBeenCalledWith({
                disableRulesetIds: [
                    `${RULESET_NAME_PREFIX}1`,
                    `${RULESET_NAME_PREFIX}2`,
                ],
            });
        });

        it('applies disables first, then enables one-by-one', async () => {
            const callArgs: unknown[] = [];
            mockUpdateEnabledRulesets.mockImplementation((arg: unknown) => {
                callArgs.push(arg);
                return Promise.resolve();
            });

            const result = await FiltersApi.updateFiltering([1], [2, 3]);

            expect(result.errors).toHaveLength(0);
            // 1 disable call + 2 enable calls
            expect(callArgs).toHaveLength(3);
            expect(callArgs[0]).toEqual({
                disableRulesetIds: [`${RULESET_NAME_PREFIX}1`],
            });
            expect(callArgs[1]).toEqual({
                enableRulesetIds: [`${RULESET_NAME_PREFIX}2`],
            });
            expect(callArgs[2]).toEqual({
                enableRulesetIds: [`${RULESET_NAME_PREFIX}3`],
            });
        });

        it('handles empty enable and disable lists', async () => {
            const result = await FiltersApi.updateFiltering([], []);

            expect(result.errors).toHaveLength(0);
            expect(mockUpdateEnabledRulesets).not.toHaveBeenCalled();
        });

        it('handles undefined enableFiltersIds', async () => {
            const result = await FiltersApi.updateFiltering([]);

            expect(result.errors).toHaveLength(0);
            expect(mockUpdateEnabledRulesets).not.toHaveBeenCalled();
        });
    });
});
