import { type SyncExpectationResult } from '@vitest/expect';
import { omit } from 'lodash-es';
import { expect } from 'vitest';

import { type CosmeticRule } from '../../../src/rules/cosmetic-rule';

const normalizeCosmeticRule = (rule: CosmeticRule): Partial<CosmeticRule> => {
    // Ignore irrelevant or problematic properties.
    const result = omit(rule, ['ruleIndex', 'filterListId']);

    return result;
};

expect.extend({
    toMatchCosmeticRule(actual: CosmeticRule, expected: CosmeticRule): SyncExpectationResult {
        const normalizedActual = normalizeCosmeticRule(actual);
        const normalizedExpected = normalizeCosmeticRule(expected);

        const pass = this.equals(normalizedActual, normalizedExpected);

        if (pass) {
            return {
                pass: true,
                message: () => 'Expected cosmetic rules not to match, but they did.',
            };
        }

        return {
            pass: false,
            message: () => 'Expected cosmetic rules to match',
            actual: normalizedActual,
            expected: normalizedExpected,
        };
    },
});
