import { describe, expect, it } from 'vitest';

import { RulesGroup, RulesGrouper } from '../../../src/filter-converter/rules-grouper';
import { type NetworkRule, NetworkRuleOption } from '../../../src/network-rule';

describe('RulesGrouper', () => {
    const getMockedNetworkRule = (enabledOptions: NetworkRuleOption[]): NetworkRule => {
        return {
            isOptionEnabled: (option: NetworkRuleOption): boolean => {
                return enabledOptions.includes(option);
            },
        } as unknown as NetworkRule;
    };

    describe('getRuleGroup', () => {
        it('should return RemoveParam group for rules with RemoveParam option', () => {
            const rule = getMockedNetworkRule([NetworkRuleOption.RemoveParam]);
            // @ts-expect-error Accessing private method for testing purposes
            const group = RulesGrouper.getRuleGroup(rule);
            expect(group).toBe(RulesGroup.RemoveParam);
        });

        it('should return RemoveHeader group for rules with RemoveHeader option', () => {
            const rule = getMockedNetworkRule([NetworkRuleOption.RemoveHeader]);
            // @ts-expect-error Accessing private method for testing purposes
            const group = RulesGrouper.getRuleGroup(rule);
            expect(group).toBe(RulesGroup.RemoveHeader);
        });

        it('should return Csp group for rules with Csp option', () => {
            const rule = getMockedNetworkRule([NetworkRuleOption.Csp]);
            // @ts-expect-error Accessing private method for testing purposes
            const group = RulesGrouper.getRuleGroup(rule);
            expect(group).toBe(RulesGroup.Csp);
        });

        it('should return BadFilter group for rules with Badfilter option', () => {
            const rule = getMockedNetworkRule([NetworkRuleOption.Badfilter]);
            // @ts-expect-error Accessing private method for testing purposes
            const group = RulesGrouper.getRuleGroup(rule);
            expect(group).toBe(RulesGroup.BadFilter);
        });

        it('should return Regular group for rules with no special options', () => {
            const rule = getMockedNetworkRule([NetworkRuleOption.NotSet]);
            // @ts-expect-error Accessing private method for testing purposes
            const group = RulesGrouper.getRuleGroup(rule);
            expect(group).toBe(RulesGroup.Regular);
        });

        it('should return Regular group for rules with other options like Redirect', () => {
            const rule = getMockedNetworkRule([NetworkRuleOption.Redirect]);
            // @ts-expect-error Accessing private method for testing purposes
            const group = RulesGrouper.getRuleGroup(rule);
            expect(group).toBe(RulesGroup.Regular);
        });
    });

    describe('groupRules', () => {
        it('should return empty groups for empty input array', () => {
            const result = RulesGrouper.groupRules([]);

            expect(result).toEqual({
                [RulesGroup.RemoveParam]: [],
                [RulesGroup.RemoveHeader]: [],
                [RulesGroup.BadFilter]: [],
                [RulesGroup.Regular]: [],
                [RulesGroup.Csp]: [],
            });
        });

        it('should group single rule correctly', () => {
            const removeParamRule = getMockedNetworkRule([NetworkRuleOption.RemoveParam]);
            const result = RulesGrouper.groupRules([removeParamRule]);

            expect(result).toEqual({
                [RulesGroup.RemoveParam]: [removeParamRule],
                [RulesGroup.RemoveHeader]: [],
                [RulesGroup.BadFilter]: [],
                [RulesGroup.Regular]: [],
                [RulesGroup.Csp]: [],
            });
        });

        it('should group multiple rules of same type correctly', () => {
            const removeParamRule1 = getMockedNetworkRule([NetworkRuleOption.RemoveParam]);
            const removeParamRule2 = getMockedNetworkRule([NetworkRuleOption.RemoveParam]);
            const result = RulesGrouper.groupRules([removeParamRule1, removeParamRule2]);

            expect(result).toEqual({
                [RulesGroup.RemoveParam]: [removeParamRule1, removeParamRule2],
                [RulesGroup.RemoveHeader]: [],
                [RulesGroup.BadFilter]: [],
                [RulesGroup.Regular]: [],
                [RulesGroup.Csp]: [],
            });
        });

        it('should group mixed rules correctly', () => {
            const removeParamRule = getMockedNetworkRule([NetworkRuleOption.RemoveParam]);
            const removeHeaderRule = getMockedNetworkRule([NetworkRuleOption.RemoveHeader]);
            const cspRule = getMockedNetworkRule([NetworkRuleOption.Csp]);
            const badFilterRule = getMockedNetworkRule([NetworkRuleOption.Badfilter]);
            const regularRule = getMockedNetworkRule([NetworkRuleOption.Important]);
            const regularRule2 = getMockedNetworkRule([NetworkRuleOption.NotSet]);

            const result = RulesGrouper.groupRules([
                removeParamRule,
                removeHeaderRule,
                cspRule,
                badFilterRule,
                regularRule,
                regularRule2,
            ]);

            expect(result).toEqual({
                [RulesGroup.RemoveParam]: [removeParamRule],
                [RulesGroup.RemoveHeader]: [removeHeaderRule],
                [RulesGroup.Csp]: [cspRule],
                [RulesGroup.BadFilter]: [badFilterRule],
                [RulesGroup.Regular]: [regularRule, regularRule2],
            });
        });

        it('should preserve order of rules within groups', () => {
            const regularRule1 = getMockedNetworkRule([NetworkRuleOption.Important]);
            const removeParamRule = getMockedNetworkRule([NetworkRuleOption.RemoveParam]);
            const regularRule2 = getMockedNetworkRule([NetworkRuleOption.NotSet]);
            const regularRule3 = getMockedNetworkRule([NetworkRuleOption.ThirdParty]);

            const result = RulesGrouper.groupRules([
                regularRule1,
                removeParamRule,
                regularRule2,
                regularRule3,
            ]);

            expect(result).toEqual({
                [RulesGroup.RemoveParam]: [removeParamRule],
                [RulesGroup.RemoveHeader]: [],
                [RulesGroup.BadFilter]: [],
                [RulesGroup.Csp]: [],
                [RulesGroup.Regular]: [regularRule1, regularRule2, regularRule3],
            });
        });

        it('should handle rules with combined options correctly', () => {
            const combinedRule1 = getMockedNetworkRule([
                NetworkRuleOption.RemoveParam,
                NetworkRuleOption.Important,
            ]);
            const combinedRule2 = getMockedNetworkRule([
                NetworkRuleOption.RemoveHeader,
                NetworkRuleOption.ThirdParty,
            ]);
            const combinedRule3 = getMockedNetworkRule([
                NetworkRuleOption.Important,
                NetworkRuleOption.ThirdParty,
            ]);

            const result = RulesGrouper.groupRules([
                combinedRule1,
                combinedRule2,
                combinedRule3,
            ]);

            // Should prioritize special options over regular ones
            expect(result).toEqual({
                [RulesGroup.RemoveParam]: [combinedRule1],
                [RulesGroup.RemoveHeader]: [combinedRule2],
                [RulesGroup.BadFilter]: [],
                [RulesGroup.Csp]: [],
                [RulesGroup.Regular]: [combinedRule3],
            });
        });
    });
});
