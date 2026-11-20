/**
 * @file Growth preservation for the dedicated selector-list region
 * (F-041, A06-C03).
 *
 * The selector-list region lives at the end of `ctx.data`. When a tiny
 * `itemCapacity`/`secondaryCapacity` forces the modifier or domain region to
 * grow during a parse, every region — including the tail — must survive the
 * reallocation and the result must equal a default-capacity parse.
 */

import { describe, expect, test } from 'vitest';

import { RuleParserPipeline } from '../../../src/ast-builder/rule-parser';

/**
 * Builds a space-separated selector of `count` descendant compounds.
 *
 * @param count Number of compounds.
 *
 * @returns Selector text.
 */
const compounds = (count: number): string => Array.from({ length: count }, (_, i) => `div.c${i}`).join(' ');

/**
 * Strips location fields so two ASTs can be compared structurally.
 *
 * @param value AST node or value.
 *
 * @returns The same value without `start`/`end` fields.
 */
function stripLocations<T>(value: T): T {
    if (Array.isArray(value)) {
        return value.map((item) => stripLocations(item)) as unknown as T;
    }
    if (value !== null && typeof value === 'object') {
        const result: Record<string, unknown> = {};
        for (const [key, child] of Object.entries(value)) {
            if (key !== 'start' && key !== 'end') {
                result[key] = stripLocations(child);
            }
        }
        return result as T;
    }
    return value;
}

const DEFAULT_PARSER = new RuleParserPipeline();

/**
 * Parses `rule` at the default capacity.
 *
 * @param rule Rule text.
 * @param options Parse options.
 *
 * @returns AST without locations.
 */
function parseDefault(rule: string, options?: Parameters<RuleParserPipeline['parse']>[1]): unknown {
    return stripLocations(DEFAULT_PARSER.parse(rule, options));
}

/**
 * Parses `rule` with a tiny primary/secondary capacity.
 *
 * @param rule Rule text.
 * @param itemCapacity Primary (modifier) capacity.
 * @param secondaryCapacity Secondary (domain) capacity.
 * @param options Parse options.
 *
 * @returns AST without locations.
 */
function parseTiny(
    rule: string,
    itemCapacity: number,
    secondaryCapacity: number,
    options?: Parameters<RuleParserPipeline['parse']>[1],
): unknown {
    const parser = new RuleParserPipeline({ itemCapacity, secondaryCapacity });
    return stripLocations(parser.parse(rule, options));
}

describe('selector-region growth preservation (F-041)', () => {
    test.each([1, 2, 3, 4])(
        'an element-hiding rule with uBO modifiers keeps its selector at itemCapacity=%i',
        (itemCapacity) => {
            const rule = `example.com,example.org##${compounds(20)}:style(color: red)`;

            expect(parseTiny(rule, itemCapacity, 2)).toEqual(parseDefault(rule));
        },
    );

    test.each([1, 2, 3, 4])(
        'an HTML filtering rule with `[$...]` modifiers keeps domains and selector at itemCapacity=%i',
        (itemCapacity) => {
            const rule = `[$m0=v0,m1=v1,m2=v2]example.com,example.org##^${compounds(20)}`;
            const options = { parseHtmlFilteringRuleBodies: true } as const;

            expect(parseTiny(rule, itemCapacity, 2, options)).toEqual(parseDefault(rule, options));
        },
    );

    test.each([1, 2, 3, 4])(
        'a growing domain list keeps the modifier region and selector at secondaryCapacity=%i',
        (secondaryCapacity) => {
            const domains = Array.from({ length: 20 }, (_, i) => `d${i}.example`).join(',');
            const rule = `[$path=/x]${domains}##^${compounds(20)}`;
            const options = { parseHtmlFilteringRuleBodies: true } as const;

            expect(parseTiny(rule, 2, secondaryCapacity, options)).toEqual(parseDefault(rule, options));
        },
    );
});
