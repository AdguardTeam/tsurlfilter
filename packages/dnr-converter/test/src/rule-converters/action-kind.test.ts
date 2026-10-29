import { describe, expect, it } from 'vitest';

import { Rule } from '../../../src/rule/rule';
import { ActionKind, isCspRule, selectActionKind } from '../../../src/rule-converters/action-kind';

/**
 * Creates a rule from its text.
 *
 * @param ruleText Rule text.
 *
 * @returns Parsed rule.
 */
function createRule(ruleText: string): Rule {
    return Rule.createFromText(1, 0, ruleText)[0];
}

describe('selectActionKind', () => {
    it.each([
        ['||example.com^$csp=script-src \'none\'', ActionKind.Csp],
        ['||example.com^$csp=script-src \'none\',important', ActionKind.Csp],
        ['||example.com^$csp=script-src \'none\',redirect=noopjs', ActionKind.Redirect],
        ['||example.com^$csp=script-src \'none\',cookie', ActionKind.Cookie],
        ['||example.com^$redirect=noopjs', ActionKind.Redirect],
        ['||example.com^', ActionKind.Block],
        ['@@||example.com^$csp', ActionKind.Allow],
    ])('selects the action kind for %s', (ruleText, expected) => {
        expect(selectActionKind(createRule(ruleText))).toBe(expected);
    });
});

describe('isCspRule', () => {
    it.each([
        ['||example.com^$csp=script-src \'none\'', true],
        ['||example.com^$csp=script-src \'none\',redirect=noopjs', false],
        ['||example.com^$csp=script-src \'none\',cookie', false],
        ['||example.com^$redirect=noopjs', false],
        ['@@||example.com^$csp', true],
        ['@@||example.com^', false],
    ])('reports whether %s belongs to the CSP ruleset', (ruleText, expected) => {
        expect(isCspRule(createRule(ruleText))).toBe(expected);
    });
});
