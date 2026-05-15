import { describe, expect, it } from 'vitest';

import { OPTION_NAMES } from '../../../src/rule/option-names';
import { type Rule } from '../../../src/rule/rule';
import { RulesGroup, RulesGrouper } from '../../../src/rule-converters/rules-grouper';

describe('RulesGrouper', () => {
    const getMockedRule = (enabledModifiers: string[]): Rule => {
        return {
            isModifierEnabled: (modifier: string): boolean => {
                return enabledModifiers.includes(modifier);
            },
        } as unknown as Rule;
    };

    describe('getRuleGroup', () => {
        it('should return RemoveParam group for rules with RemoveParam option', () => {
            const rule = getMockedRule([OPTION_NAMES.REMOVEPARAM]);
            // @ts-expect-error Accessing private method for testing purposes
            const group = RulesGrouper.getRuleGroup(rule);
            expect(group).toBe(RulesGroup.RemoveParam);
        });

        it('should return RemoveHeader group for rules with RemoveHeader option', () => {
            const rule = getMockedRule([OPTION_NAMES.REMOVEHEADER]);
            // @ts-expect-error Accessing private method for testing purposes
            const group = RulesGrouper.getRuleGroup(rule);
            expect(group).toBe(RulesGroup.RemoveHeader);
        });

        it('should return Csp group for rules with Csp option', () => {
            const rule = getMockedRule([OPTION_NAMES.CSP]);
            // @ts-expect-error Accessing private method for testing purposes
            const group = RulesGrouper.getRuleGroup(rule);
            expect(group).toBe(RulesGroup.Csp);
        });

        it('should return BadFilter group for rules with Badfilter option', () => {
            const rule = getMockedRule([OPTION_NAMES.BADFILTER]);
            // @ts-expect-error Accessing private method for testing purposes
            const group = RulesGrouper.getRuleGroup(rule);
            expect(group).toBe(RulesGroup.BadFilter);
        });

        it('should return Regular group for rules with no special options', () => {
            const rule = getMockedRule(['']);
            // @ts-expect-error Accessing private method for testing purposes
            const group = RulesGrouper.getRuleGroup(rule);
            expect(group).toBe(RulesGroup.Regular);
        });

        it('should return Regular group for rules with other options like Redirect', () => {
            const rule = getMockedRule([OPTION_NAMES.REDIRECT]);
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
                [RulesGroup.Regular]: [],
                [RulesGroup.Csp]: [],
                [RulesGroup.BadFilter]: [],
            });
        });

        it('should group single rule correctly', () => {
            const removeParamRule = getMockedRule([OPTION_NAMES.REMOVEPARAM]);
            const result = RulesGrouper.groupRules([removeParamRule]);

            expect(result).toEqual({
                [RulesGroup.RemoveParam]: [removeParamRule],
                [RulesGroup.RemoveHeader]: [],
                [RulesGroup.Regular]: [],
                [RulesGroup.Csp]: [],
                [RulesGroup.BadFilter]: [],
            });
        });

        it('should group multiple rules of same type correctly', () => {
            const removeParamRule1 = getMockedRule([OPTION_NAMES.REMOVEPARAM]);
            const removeParamRule2 = getMockedRule([OPTION_NAMES.REMOVEPARAM]);
            const result = RulesGrouper.groupRules([removeParamRule1, removeParamRule2]);

            expect(result).toEqual({
                [RulesGroup.RemoveParam]: [removeParamRule1, removeParamRule2],
                [RulesGroup.RemoveHeader]: [],
                [RulesGroup.Regular]: [],
                [RulesGroup.Csp]: [],
                [RulesGroup.BadFilter]: [],
            });
        });

        it('should group mixed rules correctly', () => {
            const removeParamRule = getMockedRule([OPTION_NAMES.REMOVEPARAM]);
            const removeHeaderRule = getMockedRule([OPTION_NAMES.REMOVEHEADER]);
            const cspRule = getMockedRule([OPTION_NAMES.CSP]);
            const regularRule = getMockedRule([OPTION_NAMES.IMPORTANT]);
            const regularRule2 = getMockedRule(['']);

            const result = RulesGrouper.groupRules([
                removeParamRule,
                removeHeaderRule,
                cspRule,
                regularRule,
                regularRule2,
            ]);

            expect(result).toEqual({
                [RulesGroup.RemoveParam]: [removeParamRule],
                [RulesGroup.RemoveHeader]: [removeHeaderRule],
                [RulesGroup.Csp]: [cspRule],
                [RulesGroup.Regular]: [regularRule, regularRule2],
                [RulesGroup.BadFilter]: [],
            });
        });

        it('should preserve order of rules within groups', () => {
            const regularRule1 = getMockedRule([OPTION_NAMES.IMPORTANT]);
            const removeParamRule = getMockedRule([OPTION_NAMES.REMOVEPARAM]);
            const regularRule2 = getMockedRule(['']);
            const regularRule3 = getMockedRule([OPTION_NAMES.THIRD_PARTY]);

            const result = RulesGrouper.groupRules([
                regularRule1,
                removeParamRule,
                regularRule2,
                regularRule3,
            ]);

            expect(result).toEqual({
                [RulesGroup.RemoveParam]: [removeParamRule],
                [RulesGroup.RemoveHeader]: [],
                [RulesGroup.Csp]: [],
                [RulesGroup.Regular]: [regularRule1, regularRule2, regularRule3],
                [RulesGroup.BadFilter]: [],
            });
        });

        it('should handle rules with combined options correctly', () => {
            const combinedRule1 = getMockedRule([
                OPTION_NAMES.REMOVEPARAM,
                OPTION_NAMES.IMPORTANT,
            ]);
            const combinedRule2 = getMockedRule([
                OPTION_NAMES.REMOVEHEADER,
                OPTION_NAMES.THIRD_PARTY,
            ]);
            const combinedRule3 = getMockedRule([
                OPTION_NAMES.IMPORTANT,
                OPTION_NAMES.THIRD_PARTY,
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
                [RulesGroup.Csp]: [],
                [RulesGroup.Regular]: [combinedRule3],
                [RulesGroup.BadFilter]: [],
            });
        });
    });
});
