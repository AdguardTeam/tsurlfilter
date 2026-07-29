import { describe, expect, test } from 'vitest';

import { type AnyParsedRule, RuleParserPipeline } from '../../src/ast-builder/rule-parser';
import { NodeType, type RawRule, RuleCategory } from '../../src/nodes';

const parser = new RuleParserPipeline();

/**
 * Type guard for RawRule.
 *
 * @param rule Rule to check.
 *
 * @returns True if the rule is a RawRule.
 */
function isRawRule(rule: AnyParsedRule): rule is RawRule {
    return rule.type === NodeType.RawRule;
}

describe('ignoreNetwork', () => {
    test('network rule returns RawRule', () => {
        const result = parser.parse('||example.com^', { ignoreNetwork: true });
        expect(isRawRule(result)).toBe(true);
        if (isRawRule(result)) {
            expect(result.raw).toBe('||example.com^');
            expect(result.category).toBe(RuleCategory.Raw);
            expect(result.kind).toBe(RuleCategory.Network);
        }
    });

    test('comment rule unaffected', () => {
        const result = parser.parse('! comment', { ignoreNetwork: true });
        expect(result.type).not.toBe(NodeType.RawRule);
    });

    test('cosmetic rule unaffected', () => {
        const result = parser.parse('example.com##.ad', { ignoreNetwork: true });
        expect(result.type).not.toBe(NodeType.RawRule);
    });
});

describe('ignoreCosmetic', () => {
    test('cosmetic rule returns RawRule', () => {
        const result = parser.parse('example.com##.ad', { ignoreCosmetic: true });
        expect(isRawRule(result)).toBe(true);
        if (isRawRule(result)) {
            expect(result.raw).toBe('example.com##.ad');
            expect(result.category).toBe(RuleCategory.Raw);
            expect(result.kind).toBe(RuleCategory.Cosmetic);
        }
    });

    test('network rule unaffected', () => {
        const result = parser.parse('||example.com^', { ignoreCosmetic: true });
        expect(result.type).not.toBe(NodeType.RawRule);
    });

    test('comment rule unaffected', () => {
        const result = parser.parse('! comment', { ignoreCosmetic: true });
        expect(result.type).not.toBe(NodeType.RawRule);
    });
});

describe('both ignore options', () => {
    test('only comments survive', () => {
        const opts = { ignoreCosmetic: true, ignoreNetwork: true } as const;
        expect(parser.parse('! comment', opts).type).not.toBe(NodeType.RawRule);
        expect(isRawRule(parser.parse('||example.com^', opts))).toBe(true);
        expect(isRawRule(parser.parse('example.com##.ad', opts))).toBe(true);
    });
});

describe('location and raws', () => {
    test('isLocIncluded populates start/end', () => {
        const result = parser.parse('||example.com^', {
            ignoreNetwork: true,
            isLocIncluded: true,
        });
        expect(isRawRule(result)).toBe(true);
        if (isRawRule(result)) {
            expect(result.start).toBe(0);
            expect(result.end).toBe('||example.com^'.length);
        }
    });
});
