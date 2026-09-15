import { describe, expect, test } from 'vitest';

import { RuleParserPipeline } from '../../src/ast-builder/rule-parser';
import { RuleKind } from '../../src/parser/classifier';
import { NetworkRuleDataReader } from '../../src/parser/network/network-rule-data-reader';

const pipeline = new RuleParserPipeline();

/**
 * Creates a network-rule reader for the given rule text.
 *
 * @param rule Rule text to parse.
 *
 * @returns Reader bound to the structural data.
 */
function readerFor(rule: string): NetworkRuleDataReader {
    const { kind, ctx } = pipeline.parseStructural(rule);
    expect(kind).toBe(RuleKind.Network);
    return new NetworkRuleDataReader(ctx, 0);
}

describe('NetworkRuleDataReader', () => {
    test('reads exception, pattern, and modifier count', () => {
        const r = readerFor('@@||example.org^');
        expect(r.exception).toBe(true);
        expect(r.getPattern()).toBe('||example.org^');
        expect(r.modifierCount).toBe(0);
    });

    test('reads regex pattern slice', () => {
        const r = readerFor('/ads?\\./');
        expect(r.getPattern()).toBe('/ads?\\./');
    });

    test('reads modifiers with values and negation', () => {
        const r = readerFor('||a.com^$third-party,domain=x.com|~y.com,~script');
        expect(r.modifierCount).toBe(3);
        expect(r.getModifierName(0)).toBe('third-party');
        expect(r.getModifierValue(0)).toBeNull();
        expect(r.isModifierNegated(0)).toBe(false);
        expect(r.getModifierName(1)).toBe('domain');
        expect(r.getModifierValue(1)).toBe('x.com|~y.com');
        expect(r.getModifierName(2)).toBe('script');
        expect(r.isModifierNegated(2)).toBe(true);
    });
});
