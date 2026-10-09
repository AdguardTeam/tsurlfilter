import { describe, expect, test } from 'vitest';

import { RuleParserPipeline } from '../../src/ast-builder/rule-parser';
import { isConversionCandidate } from '../../src/converter/candidate-filter';

const pipeline = new RuleParserPipeline();

/**
 * Structurally scans a single line and evaluates the candidate predicate.
 *
 * @param line Rule line to check.
 *
 * @returns Whether the rule is a conversion candidate.
 */
function isCandidate(line: string): boolean {
    const { kind, ctx } = pipeline.parseStructural(line);
    return isConversionCandidate(kind, ctx);
}

describe('isConversionCandidate', () => {
    test('network rule with no modifiers is NOT a candidate', () => {
        expect(isCandidate('||example.com^')).toBe(false);
    });

    test('network rule with modifiers IS a candidate', () => {
        expect(isCandidate('||example.com^$third-party')).toBe(true);
    });

    test('cosmetic rule is always a candidate', () => {
        expect(isCandidate('example.com##.ad')).toBe(true);
        expect(isCandidate('example.com##+js(foo)')).toBe(true);
    });

    test('comment is always a candidate', () => {
        expect(isCandidate('! comment')).toBe(true);
    });
});
