import { describe, expect, test } from 'vitest';

import { RuleParserPipeline } from '../../../src/ast-builder/rule-parser';
import { CapacityOverflowError } from '../../../src/errors/capacity-overflow-error';
import { MAX_DOMAIN_CAPACITY, MAX_TOKEN_CAPACITY } from '../../../src/limits';

/**
 * Build a cosmetic rule with N single-identifier domains.
 * Each domain is a single letter/word, producing ~2 tokens per domain
 * (identifier + comma separator) — far below the token hard cap even
 * with MAX_DOMAIN_CAPACITY+1 domains.
 *
 * @param n Number of domains.
 *
 * @returns Rule source string.
 */
function makeCosmeticSingle(n: number): string {
    // Use short base-26 names to keep token count low.
    const domains = Array.from({ length: n }, (_, i) => {
        const letter = String.fromCharCode(97 + (i % 26)); // 'a'..'z'
        const suffix = Math.floor(i / 26);
        return suffix === 0 ? letter : `${letter}${suffix}`;
    }).join(',');
    return `${domains}##.ad`;
}

describe('Hard-cap overflow — CapacityOverflowError', () => {
    test('throws a generic error (not CapacityOverflowError) when grow:false and domains overflow', () => {
        const parser = new RuleParserPipeline({ grow: false, secondaryCapacity: 2 });
        let err: unknown;
        try {
            parser.parse('a,b,c##.ad');
        } catch (e) {
            err = e;
        }
        expect(err).toBeInstanceOf(Error);
        expect(err).not.toBeInstanceOf(CapacityOverflowError);
    });

    test('throws CapacityOverflowError when domains exceed hard cap (MAX_DOMAIN_CAPACITY)', () => {
        // Start at MAX_DOMAIN_CAPACITY; first domain beyond that → must fail to grow.
        // Use a large token capacity to avoid hitting the token cap first.
        const n = MAX_DOMAIN_CAPACITY + 1;
        const parser = new RuleParserPipeline({
            tokenCapacity: MAX_TOKEN_CAPACITY,
            secondaryCapacity: MAX_DOMAIN_CAPACITY,
        });
        let err: unknown;
        try {
            parser.parse(makeCosmeticSingle(n));
        } catch (e) {
            err = e;
        }
        expect(err).toBeInstanceOf(CapacityOverflowError);
        const castedErr = err as CapacityOverflowError;
        expect(castedErr.region).toBe('domains');
    });

    test('status is reset after CapacityOverflowError so next parse works', () => {
        const n = MAX_DOMAIN_CAPACITY + 1;
        const parser = new RuleParserPipeline({
            tokenCapacity: MAX_TOKEN_CAPACITY,
            secondaryCapacity: MAX_DOMAIN_CAPACITY,
        });
        expect(() => parser.parse(makeCosmeticSingle(n))).toThrow(CapacityOverflowError);
        // Subsequent small parse should succeed
        const rule = parser.parse('example.com##.ad');
        expect(rule.type).toBe('ElementHidingRule');
    });
});
