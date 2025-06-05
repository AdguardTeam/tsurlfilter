import { describe, expect, test } from 'vitest';

import { RuleCategorizer } from '../../src/utils/categorizer';
import { CosmeticRuleType } from '../../src/nodes';

describe('RuleCategorizer', () => {
    describe('getCosmeticRuleType', () => {
        test.each([
            {
                actual: 'example.com##.class',
                expected: CosmeticRuleType.ElementHidingRule,
            },
            {
                actual: 'example.com#?#.class:has(.another)',
                expected: CosmeticRuleType.ElementHidingRule,
            },

            {
                actual: 'example.com#$#.selector { color: red; }',
                expected: CosmeticRuleType.CssInjectionRule,
            },
            {
                actual: 'example.com##.selector:style(color: red;)',
                expected: CosmeticRuleType.CssInjectionRule,
            },

            {
                actual: 'example.com$$div:contains(foo)',
                expected: CosmeticRuleType.HtmlFilteringRule,
            },
            {
                actual: 'example.com$$div[custom_attr]',
                expected: CosmeticRuleType.HtmlFilteringRule,
            },
            {
                actual: 'example.com##^script:has-text(foo)',
                expected: CosmeticRuleType.HtmlFilteringRule,
            },

            {
                actual: "example.com#%#//scriptlet('foo')",
                expected: CosmeticRuleType.ScriptletInjectionRule,
            },
            {
                actual: 'example.com##+js(foo)',
                expected: CosmeticRuleType.ScriptletInjectionRule,
            },
            {
                actual: 'example.com#$#abp-snippet',
                expected: CosmeticRuleType.ScriptletInjectionRule,
            },

            {
                actual: "example.com#%#const foo = 'bar';",
                expected: CosmeticRuleType.JsInjectionRule,
            },

            // not a cosmetic rule
            {
                actual: '/ads.js^$script',
                expected: null,
            },

            // cosmetic rule, but invalid
            {
                actual: '##+js(foo',
                expected: null,
            },
        ])('should categorize \'$actual\' as \'$expected\'', ({ actual, expected }) => {
            expect(RuleCategorizer.getCosmeticRuleType(actual)).toBe(expected);
        });
    });
});
