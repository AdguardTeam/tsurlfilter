/**
 * @file Tests for `RuleParserPipeline.parseRange()` with cosmetic rules.
 *
 * Validates that parseRange correctly threads the caller's `ctx` and
 * `dataOffset` through the cosmetic dispatch, and that `ruleStart`/`ruleEnd`
 * are applied to the result.
 */

import { describe, expect, test } from 'vitest';

import { RuleParserPipeline } from '../../src/ast-builder/rule-parser';
import { createParserContext, initParserContext } from '../../src/parser/context';
import { Tokenizer } from '../../src/tokenizer/tokenizer';

const TOKEN_CAPACITY = 1024;
const pipeline = new RuleParserPipeline();

/**
 * Helper: tokenize `source`, find the token range for `ruleText` within it,
 * then call `parseRange` at a given `dataOffset`.
 *
 * @param source Full source string (may contain a prefix before the rule).
 * @param ruleStart Character offset where the rule starts in `source`.
 * @param ruleEnd Character offset where the rule ends in `source`.
 * @param dataOffset Offset within ctx.data to use.
 *
 * @returns The parsed AST node.
 */
function parseSubRange(
    source: string,
    ruleStart: number,
    ruleEnd: number,
    dataOffset: number,
) {
    const tokenizer = new Tokenizer(TOKEN_CAPACITY);
    tokenizer.setSource(source);

    const ctx = createParserContext(TOKEN_CAPACITY, 64);
    initParserContext(ctx, source, tokenizer);

    // Find token indices covering [ruleStart, ruleEnd)
    let startTi = 0;
    while (startTi < ctx.tokenCount && ctx.ends[startTi] <= ruleStart) {
        startTi += 1;
    }

    let endTi = startTi;
    while (endTi < ctx.tokenCount && ctx.ends[endTi] <= ruleEnd) {
        endTi += 1;
    }
    // endTi should point past the last token of the rule
    if (endTi < ctx.tokenCount && ctx.ends[endTi] <= ruleEnd) {
        endTi += 1;
    }

    return pipeline.parseRange(ctx, startTi, endTi, dataOffset, { isLocIncluded: true });
}

describe('RuleParserPipeline.parseRange — cosmetic rules', () => {
    test('element hiding rule via parseRange', () => {
        // The rule is the whole source (simplest case, dataOffset=0)
        const source = 'example.com##.ads';
        const result = parseSubRange(source, 0, source.length, 0);

        expect(result.type).toBe('ElementHidingRule');
        expect(result.start).toBe(0);
        expect(result.end).toBe(source.length);

        if (result.type === 'ElementHidingRule') {
            expect(result.exception).toBe(false);
            expect(result.body.selectorList.value).toBe('.ads');
        }
    });

    test('element hiding exception via parseRange', () => {
        const source = 'example.com#@#.ads';
        const result = parseSubRange(source, 0, source.length, 0);

        expect(result.type).toBe('ElementHidingRule');

        if (result.type === 'ElementHidingRule') {
            expect(result.exception).toBe(true);
            expect(result.body.selectorList.value).toBe('.ads');
        }
    });

    test('ADG scriptlet injection via parseRange', () => {
        const source = "example.com#%#//scriptlet('abort-on-property-read', 'ads')";
        const result = parseSubRange(source, 0, source.length, 0);

        expect(result.type).toBe('ScriptletInjectionRule');
        expect(result.start).toBe(0);
        expect(result.end).toBe(source.length);

        if (result.type === 'ScriptletInjectionRule') {
            expect(result.exception).toBe(false);
            expect(result.syntax).toBe('AdGuard');
        }
    });

    test('uBO scriptlet injection via parseRange', () => {
        const source = 'example.com##+js(set, ads, true)';
        const result = parseSubRange(source, 0, source.length, 0);

        expect(result.type).toBe('ScriptletInjectionRule');
        expect(result.start).toBe(0);
        expect(result.end).toBe(source.length);

        if (result.type === 'ScriptletInjectionRule') {
            expect(result.exception).toBe(false);
            expect(result.syntax).toBe('UblockOrigin');
        }
    });

    test('ADG JS injection via parseRange', () => {
        const source = 'example.com#%#var a = 1;';
        const result = parseSubRange(source, 0, source.length, 0);

        expect(result.type).toBe('JsInjectionRule');
        expect(result.start).toBe(0);
        expect(result.end).toBe(source.length);
    });

    test('parseRange produces correct result with parse() as baseline', () => {
        // Compare parseRange output against parse() output for multiple rules
        const rules = [
            'example.com##.ads',
            'example.com#@#.banner',
            "example.com#%#//scriptlet('abort-on-property-read', 'ads')",
            'example.com##+js(set, ads, true)',
            'example.com#%#var a = 1;',
        ];

        for (const rule of rules) {
            const expected = pipeline.parse(rule, { isLocIncluded: true });

            const tokenizer = new Tokenizer(TOKEN_CAPACITY);
            tokenizer.setSource(rule);

            const ctx = createParserContext(TOKEN_CAPACITY, 64);
            initParserContext(ctx, rule, tokenizer);

            const rangeResult = pipeline.parseRange(ctx, 0, ctx.tokenCount, 0, { isLocIncluded: true });

            expect(rangeResult).toEqual(expected);
        }
    });
});
