import { describe, expect, test } from 'vitest';

import { type AnyParsedRule, RuleParserPipeline } from '../../src/ast-builder/rule-parser';
import type { InvalidRule } from '../../src/nodes-new';

const parser = new RuleParserPipeline();

/**
 * Type guard for InvalidRule.
 *
 * @param rule Rule to check.
 *
 * @returns True if the rule is an InvalidRule.
 */
function isInvalidRule(rule: AnyParsedRule): rule is InvalidRule {
    return rule.type === 'InvalidRule';
}

describe('ignoreNetwork', () => {
    test('network rule returns InvalidRule', () => {
        const result = parser.parse('||example.com^', { ignoreNetwork: true });
        expect(isInvalidRule(result)).toBe(true);
        if (isInvalidRule(result)) {
            expect(result.error.name).toBe('RuleIgnoredError');
            expect(result.error.message).toContain('ignoreNetwork');
            expect(result.raw).toBe('||example.com^');
        }
    });

    test('comment rule unaffected', () => {
        const result = parser.parse('! comment', { ignoreNetwork: true });
        expect(result.type).not.toBe('InvalidRule');
    });

    test('cosmetic rule unaffected', () => {
        const result = parser.parse('example.com##.ad', { ignoreNetwork: true });
        expect(result.type).not.toBe('InvalidRule');
    });
});

describe('ignoreCosmetic', () => {
    test('cosmetic rule returns InvalidRule', () => {
        const result = parser.parse('example.com##.ad', { ignoreCosmetic: true });
        expect(isInvalidRule(result)).toBe(true);
        if (isInvalidRule(result)) {
            expect(result.error.name).toBe('RuleIgnoredError');
            expect(result.error.message).toContain('ignoreCosmetic');
        }
    });

    test('network rule unaffected', () => {
        const result = parser.parse('||example.com^', { ignoreCosmetic: true });
        expect(result.type).not.toBe('InvalidRule');
    });

    test('comment rule unaffected', () => {
        const result = parser.parse('! comment', { ignoreCosmetic: true });
        expect(result.type).not.toBe('InvalidRule');
    });
});

describe('both ignore options', () => {
    test('only comments survive', () => {
        const opts = { ignoreCosmetic: true, ignoreNetwork: true } as const;
        expect(parser.parse('! comment', opts).type).not.toBe('InvalidRule');
        expect(isInvalidRule(parser.parse('||example.com^', opts))).toBe(true);
        expect(isInvalidRule(parser.parse('example.com##.ad', opts))).toBe(true);
    });
});

describe('location and raws', () => {
    test('isLocIncluded populates start/end', () => {
        const result = parser.parse('||example.com^', {
            ignoreNetwork: true,
            isLocIncluded: true,
        });
        expect(isInvalidRule(result)).toBe(true);
        if (isInvalidRule(result)) {
            expect(result.start).toBe(0);
            expect(result.end).toBe('||example.com^'.length);
            expect(result.error.start).toBe(0);
            expect(result.error.end).toBe('||example.com^'.length);
        }
    });
});
