import { describe, expect, test } from 'vitest';

import { RuleKind } from '../../src/parser/classifier';
import { createParserContext, initParserContext } from '../../src/parser/context';
import { RuleParser } from '../../src/parser/rule';
import { Tokenizer } from '../../src/tokenizer/tokenizer';

const tokenizer = new Tokenizer(1024);
const ctx = createParserContext();

/**
 * Helper to classify a rule with given options.
 *
 * @param source Rule source string.
 * @param options Parser options.
 *
 * @returns The rule kind.
 */
function classify(source: string, options: Parameters<typeof RuleParser.parse>[4]): RuleKind {
    tokenizer.setSource(source);
    initParserContext(ctx, source, tokenizer);
    return RuleParser.parse(ctx, 0, ctx.tokenCount, 0, options);
}

describe('ignoreNetwork', () => {
    test('returns RuleKind.Network without parsing', () => {
        const kind = classify('||example.com^', { ignoreNetwork: true });
        expect(kind).toBe(RuleKind.Network);
    });

    test('does not affect comments', () => {
        const kind = classify('! comment', { ignoreNetwork: true });
        expect(kind).toBe(RuleKind.Comment);
    });

    test('does not affect cosmetic rules', () => {
        const kind = classify('example.com##.ad', { ignoreNetwork: true });
        expect(kind).toBe(RuleKind.Cosmetic);
    });
});

describe('ignoreCosmetic', () => {
    test('returns RuleKind.Cosmetic without parsing', () => {
        const kind = classify('example.com##.ad', { ignoreCosmetic: true });
        expect(kind).toBe(RuleKind.Cosmetic);
    });

    test('does not affect comments', () => {
        const kind = classify('! comment', { ignoreCosmetic: true });
        expect(kind).toBe(RuleKind.Comment);
    });

    test('does not affect network rules', () => {
        const kind = classify('||example.com^', { ignoreCosmetic: true });
        expect(kind).toBe(RuleKind.Network);
    });
});

describe('ignore* zeroes ctx.data[0]', () => {
    test('ignoreNetwork zeroes ctx.data[0]', () => {
        // Pre-poison ctx.data[0] so we can prove the parser zeroed it.
        tokenizer.setSource('||example.com^');
        initParserContext(ctx, '||example.com^', tokenizer);
        ctx.data[0] = 0xDEADBEEF | 0;
        RuleParser.parse(ctx, 0, ctx.tokenCount, 0, { ignoreNetwork: true });
        expect(ctx.data[0]).toBe(0);
    });

    test('ignoreCosmetic zeroes ctx.data[0]', () => {
        tokenizer.setSource('example.com##.ad');
        initParserContext(ctx, 'example.com##.ad', tokenizer);
        ctx.data[0] = 0xDEADBEEF | 0;
        RuleParser.parse(ctx, 0, ctx.tokenCount, 0, { ignoreCosmetic: true });
        expect(ctx.data[0]).toBe(0);
    });
});

describe('options resolution', () => {
    test('undefined options uses defaults (parses normally)', () => {
        const kind = classify('||example.com^', undefined);
        expect(kind).toBe(RuleKind.Network);
    });

    test('partial options merge with defaults', () => {
        // Only ignoreNetwork specified; other defaults remain.
        const kind = classify('||example.com^', { ignoreNetwork: true });
        expect(kind).toBe(RuleKind.Network);
    });
});
