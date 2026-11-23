/**
 * @file Readers borrow the pipeline's buffers, so they must refuse to read
 * after the context has been reused (F-042, T-005).
 */

import { describe, expect, test } from 'vitest';

import { RuleParserPipeline } from '../../src/ast-builder/rule-parser';
import { RuleKind } from '../../src/parser/classifier';
import { CosmeticRuleDataReader } from '../../src/parser/cosmetic/cosmetic-rule-data-reader';
import { NetworkRuleDataReader } from '../../src/parser/network/network-rule-data-reader';

const STALE_MESSAGE = /reader is stale/i;

describe('reader generation guard', () => {
    test('a network reader rejects access after another parse', () => {
        const parser = new RuleParserPipeline();
        const first = parser.parseStructural('||example.com^$third-party');

        expect(first.kind).toBe(RuleKind.Network);
        const reader = new NetworkRuleDataReader(first.ctx);
        expect(reader.getPattern()).toBe('||example.com^');

        // The next parse overwrites `ctx.data` and `ctx.source` in place.
        parser.parseStructural('||other.example^$script');

        expect(() => reader.getPattern()).toThrow(STALE_MESSAGE);
        expect(() => reader.exception).toThrow(STALE_MESSAGE);
        expect(() => reader.modifierCount).toThrow(STALE_MESSAGE);
        expect(() => reader.getModifierName(0)).toThrow(STALE_MESSAGE);
        expect(() => reader.getModifierValue(0)).toThrow(STALE_MESSAGE);
        expect(() => reader.isModifierNegated(0)).toThrow(STALE_MESSAGE);
    });

    test('a cosmetic reader rejects access after another parse', () => {
        const parser = new RuleParserPipeline();
        const first = parser.parseStructural('example.com##.ad');

        expect(first.kind).toBe(RuleKind.Cosmetic);
        const reader = new CosmeticRuleDataReader(first.ctx);
        expect(reader.getBody()).toBe('.ad');

        parser.parseStructural('example.org##.banner');

        expect(() => reader.getBody()).toThrow(STALE_MESSAGE);
        expect(() => reader.exception).toThrow(STALE_MESSAGE);
        expect(() => reader.separatorKind).toThrow(STALE_MESSAGE);
        expect(() => reader.hasModifiers).toThrow(STALE_MESSAGE);
        expect(() => reader.isScriptlet).toThrow(STALE_MESSAGE);
        expect(() => reader.getSeparator()).toThrow(STALE_MESSAGE);
        expect(() => reader.domainCount).toThrow(STALE_MESSAGE);
        expect(() => reader.getDomains()).toThrow(STALE_MESSAGE);
        expect(() => reader.getScriptletParams()).toThrow(STALE_MESSAGE);
    });

    test('reset() also invalidates a reader', () => {
        const parser = new RuleParserPipeline();
        const { ctx } = parser.parseStructural('||example.com^');
        const reader = new NetworkRuleDataReader(ctx);

        parser.reset();

        expect(() => reader.getPattern()).toThrow(STALE_MESSAGE);
    });

    test('reading before the next parse keeps working', () => {
        const parser = new RuleParserPipeline();
        const { ctx } = parser.parseStructural('||example.com^$third-party');
        const reader = new NetworkRuleDataReader(ctx);

        expect(reader.modifierCount).toBe(1);
        expect(reader.getModifierName(0)).toBe('third-party');
        expect(reader.exception).toBe(false);
    });
});
