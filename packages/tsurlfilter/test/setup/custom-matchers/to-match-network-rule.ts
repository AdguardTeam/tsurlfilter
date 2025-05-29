import { expect } from 'vitest';
import { omit } from 'lodash-es';
import { type SyncExpectationResult } from '@vitest/expect';
import { type NetworkRule } from '../../../src/rules/network-rule';

const normalizeNetworkRule = (rule: NetworkRule): Partial<NetworkRule> => {
    const pattern = rule.getPattern();

    // Ignore irrelevant or problematic properties.
    const result = omit(rule, ['ruleIndex', 'filterListId', 'advancedModifier']);

    // If tests calls matching, it will prepare the pattern, but this not happens for newly created rules.
    Object.defineProperty(result, 'pattern', {
        value: pattern,
    });

    return result;
};

expect.extend({
    toMatchNetworkRule(actual: NetworkRule, expected: NetworkRule): SyncExpectationResult {
        const normalizedActual = normalizeNetworkRule(actual);
        const normalizedExpected = normalizeNetworkRule(expected);

        const pass = this.equals(normalizedActual, normalizedExpected);

        if (pass) {
            return {
                pass: true,
                message: () => 'Expected network rules not to match, but they did.',
            };
        }

        return {
            pass: false,
            message: () => 'Expected network rules to match',
            actual: normalizedActual,
            expected: normalizedExpected,
        };
    },
});
