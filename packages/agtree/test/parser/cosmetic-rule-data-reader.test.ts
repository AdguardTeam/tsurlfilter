import { describe, expect, test } from 'vitest';

import { RuleParserPipeline } from '../../src/ast-builder/rule-parser';
import { RuleKind } from '../../src/parser/classifier';
import { CosmeticRuleDataReader } from '../../src/parser/cosmetic/cosmetic-rule-data-reader';

const pipeline = new RuleParserPipeline();

/**
 * Creates a cosmetic-rule reader for the given rule text.
 *
 * @param rule Rule text to parse.
 *
 * @returns Reader bound to the structural data.
 */
function readerFor(rule: string): CosmeticRuleDataReader {
    const { kind, ctx } = pipeline.parseStructural(rule);
    expect(kind).toBe(RuleKind.Cosmetic);
    return new CosmeticRuleDataReader(ctx, 0);
}

describe('CosmeticRuleDataReader', () => {
    test('element hiding: body + no domains', () => {
        const r = readerFor('##.banner');
        expect(r.exception).toBe(false);
        expect(r.hasModifiers).toBe(false);
        expect(r.getBody()).toBe('.banner');
        expect(r.domainCount).toBe(0);
        expect(r.getDomains()).toEqual([]);
    });

    test('domains permitted + restricted', () => {
        const r = readerFor('example.org,~sub.example.org##banner');
        expect(r.getBody()).toBe('banner');
        expect(r.getDomains()).toEqual([
            { value: 'example.org', exception: false },
            { value: 'sub.example.org', exception: true },
        ]);
    });

    test('exception separator', () => {
        const r = readerFor('example.com#@#.ad');
        expect(r.exception).toBe(true);
        expect(r.getBody()).toBe('.ad');
    });

    test('detects [$...] modifier presence', () => {
        const r = readerFor('[$path=/foo]example.com##.ad');
        expect(r.hasModifiers).toBe(true);
    });

    test('reads ADG scriptlet params with quotes intact', () => {
        const r = readerFor("#%#//scriptlet('abp-abort-current-inline-script', 'a')");
        expect(r.isScriptlet).toBe(true);
        expect(r.getScriptletParams()).toEqual(["'abp-abort-current-inline-script'", "'a'"]);
    });
});
