import { describe, expect, test } from 'vitest';

import { RuleParserPipeline } from '../../../src/ast-builder/rule-parser';
import { CapacityOverflowError } from '../../../src/errors/capacity-overflow-error';

/**
 * Build a cosmetic rule with N domains.
 *
 * @param n Number of domains.
 *
 * @returns Rule source string.
 */
function makeCosmetic(n: number): string {
    const domains = Array.from({ length: n }, (_, i) => `d${i}.com`).join(',');
    return `${domains}##.ad`;
}

/**
 * Build a network rule with N modifiers.
 *
 * @param n Number of modifiers.
 *
 * @returns Rule source string.
 */
function makeNetwork(n: number): string {
    const mods = Array.from({ length: n }, (_, i) => `m${i}`).join(',');
    return `||example.com^$${mods}`;
}

describe('grow: false — legacy throw behavior preserved', () => {
    test('domain overflow with grow:false throws a generic Error, not CapacityOverflowError', () => {
        const parser = new RuleParserPipeline({ grow: false, secondaryCapacity: 5 });
        // 6 domains > 5-domain capacity
        const source = 'a.com,b.com,c.com,d.com,e.com,f.com##.ad';
        let err: unknown;
        try {
            parser.parse(source);
        } catch (e) {
            err = e;
        }
        expect(err).toBeInstanceOf(Error);
        expect(err).not.toBeInstanceOf(CapacityOverflowError);
    });

    test('modifier overflow with grow:false throws a generic Error', () => {
        const parser = new RuleParserPipeline({ grow: false, itemCapacity: 3 });
        // 4 modifiers > 3-modifier capacity
        const source = makeNetwork(4);
        expect(() => parser.parse(source)).toThrow(Error);
    });

    test('domain overflow with grow:false does NOT grow the buffer', () => {
        const n = 10;
        const parser = new RuleParserPipeline({ grow: false, secondaryCapacity: n - 1 });
        let err: unknown;
        try {
            parser.parse(makeCosmetic(n));
        } catch (e) {
            err = e;
        }
        expect(err).toBeInstanceOf(Error);
    });

    test('default grow:true parses large rules without throwing', () => {
        const parser = new RuleParserPipeline();
        // These would overflow default capacities but grow:true allows them
        expect(() => parser.parse(makeCosmetic(200))).not.toThrow();
        expect(() => parser.parse(makeNetwork(128))).not.toThrow();
    });
});
