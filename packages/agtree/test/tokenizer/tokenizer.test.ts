import { describe, expect, test } from 'vitest';

import { TokenType } from '../../src/tokenizer/token-types';
import { Tokenizer } from '../../src/tokenizer/tokenizer';

type TokenResult = {
    type: TokenType;
    value: string;
};

/**
 * Extract tokens from a Tokenizer instance as readable { type, value } objects.
 * `start` is the source position of the first token (defaults to 0).
 *
 * @param tokenizer Tokenizer instance with tokenized data.
 * @param start Source offset corresponding to the start of the first token in the tokenizer (for correct slicing).
 *
 * @returns Array of token type and value objects.
 */
const extractTokens = (tokenizer: Tokenizer, start = 0): TokenResult[] => {
    const tokens: TokenResult[] = [];
    let prevEnd = start;
    const { source } = tokenizer;

    for (let i = 0; i < tokenizer.tokenCount; i += 1) {
        tokens.push({
            type: tokenizer.types[i],
            value: source.slice(prevEnd, tokenizer.ends[i]),
        });
        prevEnd = tokenizer.ends[i];
    }

    return tokens;
};

/**
 * Convenience: create Tokenizer, tokenize from offset 0, return instance.
 *
 * @param source Source string to tokenize.
 * @param capacity Maximum number of tokens to store per tokenize call.
 *
 * @returns Tokenizer instance with tokenized data ready for extraction.
 */
function tokenize(source: string, capacity = 1024): Tokenizer {
    const t = new Tokenizer(capacity);
    t.setSource(source);
    return t;
}

describe('Tokenizer', () => {
    describe('Basic Token Types', () => {
        test('empty string', () => {
            const t = tokenize('');
            expect(t.tokenCount).toBe(0);
            expect(t.offset).toBe(0);
        });

        test('single-character tokens', () => {
            const input = '=/,(){}[]|@*\'"!+&~^.;:#$?%';
            const t = tokenize(input);
            const tokens = extractTokens(t);
            expect(tokens.map((tok) => tok.type)).toEqual([
                TokenType.EqualsSign,
                TokenType.Slash,
                TokenType.Comma,
                TokenType.OpenParen,
                TokenType.CloseParen,
                TokenType.OpenBrace,
                TokenType.CloseBrace,
                TokenType.OpenSquare,
                TokenType.CloseSquare,
                TokenType.Pipe,
                TokenType.AtSign,
                TokenType.Asterisk,
                TokenType.Apostrophe,
                TokenType.Quote,
                TokenType.ExclamationMark,
                TokenType.PlusSign,
                TokenType.AndSign,
                TokenType.Tilde,
                TokenType.Caret,
                TokenType.Dot,
                TokenType.Semicolon,
                TokenType.Colon,
                TokenType.HashMark,
                TokenType.DollarSign,
                TokenType.QuestionMark,
                TokenType.Percent,
            ]);
        });

        test('whitespace sequences', () => {
            const input = 'a \t  b';
            const t = tokenize(input);
            const tokens = extractTokens(t);
            expect(tokens).toEqual([
                { type: TokenType.Letter, value: 'a' },
                { type: TokenType.Whitespace, value: ' \t  ' },
                { type: TokenType.Letter, value: 'b' },
            ]);
        });

        test('identifiers with alphanumeric, dash, and underscore', () => {
            const input = 'abc123 A_B-C test-123_xyz';
            const t = tokenize(input);
            const tokens = extractTokens(t);
            expect(tokens).toEqual([
                { type: TokenType.Letter, value: 'abc' },
                { type: TokenType.Digit, value: '123' },
                { type: TokenType.Whitespace, value: ' ' },
                { type: TokenType.Letter, value: 'A' },
                { type: TokenType.Underscore, value: '_' },
                { type: TokenType.Letter, value: 'B' },
                { type: TokenType.Hyphen, value: '-' },
                { type: TokenType.Letter, value: 'C' },
                { type: TokenType.Whitespace, value: ' ' },
                { type: TokenType.Letter, value: 'test' },
                { type: TokenType.Hyphen, value: '-' },
                { type: TokenType.Digit, value: '123' },
                { type: TokenType.Underscore, value: '_' },
                { type: TokenType.Letter, value: 'xyz' },
            ]);
        });

        test('escaped characters', () => {
            const input = '\\n\\t\\\\\\$';
            const t = tokenize(input);
            const tokens = extractTokens(t);
            expect(tokens).toEqual([
                { type: TokenType.Escaped, value: '\\n' },
                { type: TokenType.Escaped, value: '\\t' },
                { type: TokenType.Escaped, value: '\\\\' },
                { type: TokenType.Escaped, value: '\\$' },
            ]);
        });

        test('backslash at end of input becomes symbol', () => {
            const input = 'test\\';
            const t = tokenize(input);
            const tokens = extractTokens(t);
            expect(tokens[1]).toEqual({ type: TokenType.Symbol, value: '\\' });
        });

        test('symbol fallback for non-mapped ASCII characters', () => {
            const input = '<>`';
            const t = tokenize(input);
            const tokens = extractTokens(t);
            tokens.forEach((tok) => {
                expect(tok.type).toBe(TokenType.Symbol);
            });
        });

        test('non-ASCII characters as symbols', () => {
            const input = 'test😀你好';
            const t = tokenize(input);
            const tokens = extractTokens(t);
            expect(tokens.length).toBeGreaterThan(1);
            expect(tokens.some((tok) => tok.type === TokenType.NonAscii)).toBe(true);
        });
    });

    describe('Line Break Handling', () => {
        test('emits LineBreak token for LF and continues tokenizing', () => {
            const input = 'abc\ndef';
            const t = tokenize(input);
            const tokens = extractTokens(t);
            expect(tokens).toEqual([
                { type: TokenType.Letter, value: 'abc' },
                { type: TokenType.LineBreak, value: '\n' },
                { type: TokenType.Letter, value: 'def' },
            ]);
            expect(t.offset).toBe(input.length);
        });

        test('emits LineBreak token for CR and continues tokenizing', () => {
            const input = 'test\rmore';
            const t = tokenize(input);
            const tokens = extractTokens(t);
            expect(tokens).toContainEqual({ type: TokenType.LineBreak, value: '\r' });
            expect(t.offset).toBe(input.length);
        });

        test('emits single LineBreak token for CRLF', () => {
            const input = 'first\r\nsecond';
            const t = tokenize(input);
            const tokens = extractTokens(t);
            expect(tokens).toEqual([
                { type: TokenType.Letter, value: 'first' },
                { type: TokenType.LineBreak, value: '\r\n' },
                { type: TokenType.Letter, value: 'second' },
            ]);
        });

        test('chunk-by-chunk processing via eof() and multiple tokenize() calls', () => {
            const input = 'line1\nline2\nline3';
            const t = new Tokenizer(1024);
            t.source = input;
            expect(t.eof()).toBe(false);
            t.tokenize();
            expect(t.eof()).toBe(true);
            // line+1, \n, line+2, \n, line+3 = 8 tokens (Letter+Digit per word)
            expect(t.tokenCount).toBe(8);
        });
    });

    describe('Start Offset', () => {
        test('tokenizes from an offset in the middle of a string', () => {
            const input = 'skip this|parse this';
            const t = new Tokenizer(1024);
            t.setSource(input, 10);
            const tokens = extractTokens(t, 10);
            expect(tokens[0]).toEqual({ type: TokenType.Letter, value: 'parse' });
        });

        test('offset at end of string produces no tokens', () => {
            const input = 'test';
            const t = new Tokenizer(1024);
            t.setSource(input, 4);
            expect(t.tokenCount).toBe(0);
            expect(t.offset).toBe(4);
        });

        test('offset beyond string length produces no tokens', () => {
            const input = 'test';
            const t = new Tokenizer(1024);
            t.setSource(input, 100);
            expect(t.tokenCount).toBe(0);
            expect(t.offset).toBe(100);
        });
    });

    describe('Buffer Capacity', () => {
        test('stops when capacity is reached', () => {
            const input = 'a b c d e f g';
            const t = new Tokenizer(5);
            t.setSource(input);
            expect(t.tokenCount).toBeLessThanOrEqual(5);
            expect(t.offset).toBeLessThan(input.length);
        });

        test('tokenizes full string when within capacity', () => {
            const input = 'a b c';
            const t = new Tokenizer(100);
            t.setSource(input);
            // 5 tokens: a, whitespace, b, whitespace, c
            expect(t.tokenCount).toBe(5);
            expect(t.offset).toBe(input.length);
        });

        test('capacity limiting is deterministic across calls', () => {
            const input = 'a'.repeat(100);
            const t = new Tokenizer(10);
            t.setSource(input);
            const firstTokenCount = t.tokenCount;
            const firstOffset = t.offset;
            t.offset = 0;
            t.tokenize();
            expect(t.tokenCount).toBe(firstTokenCount);
            expect(t.offset).toBe(firstOffset);
        });
    });

    describe('Buffer Reuse', () => {
        test('overwrites previous tokens when source changes', () => {
            const t = new Tokenizer(1024);
            t.setSource('first|test');
            expect(t.tokenCount).toBeGreaterThan(0);

            t.setSource('abc');
            expect(t.tokenCount).toBe(1);
            expect(t.types[0]).toBe(TokenType.Letter);
            expect(t.ends[0]).toBe(3);
        });

        test('buffer data from previous call is overwritten', () => {
            const t = new Tokenizer(1024);
            t.setSource('example.com');
            const firstTypes = Array.from(t.types.slice(0, t.tokenCount));

            t.setSource('test');
            const secondTypes = Array.from(t.types.slice(0, t.tokenCount));

            expect(firstTypes).not.toEqual(secondTypes);
        });
    });

    describe('Complex Real-World Patterns', () => {
        test('domain pattern', () => {
            const input = 'example.com';
            const t = tokenize(input);
            expect(extractTokens(t)).toEqual([
                { type: TokenType.Letter, value: 'example' },
                { type: TokenType.Dot, value: '.' },
                { type: TokenType.Letter, value: 'com' },
            ]);
        });

        test('filter rule with options', () => {
            const input = '||example.org^$third-party,domain=test.com';
            const t = tokenize(input);
            const tokens = extractTokens(t);
            expect(tokens[0]).toEqual({ type: TokenType.Pipe, value: '|' });
            expect(tokens.some((tok) => tok.type === TokenType.Caret)).toBe(true);
            expect(tokens.some((tok) => tok.type === TokenType.DollarSign)).toBe(true);
            expect(tokens.some((tok) => tok.type === TokenType.Comma)).toBe(true);
        });

        test('regex pattern with escapes', () => {
            const input = '/ad[\\s\\S]*banner/i';
            const t = tokenize(input);
            const tokens = extractTokens(t);
            expect(tokens.filter((tok) => tok.type === TokenType.Escaped).length).toBe(2);
            expect(tokens.some((tok) => tok.type === TokenType.OpenSquare)).toBe(true);
            expect(tokens.some((tok) => tok.type === TokenType.CloseSquare)).toBe(true);
        });

        test('CSS selector pattern', () => {
            const input = 'div[class*="ad"]';
            const t = tokenize(input);
            const tokens = extractTokens(t);
            expect(tokens[0]).toEqual({ type: TokenType.Letter, value: 'div' });
            expect(tokens.some((tok) => tok.type === TokenType.Asterisk)).toBe(true);
            expect(tokens.some((tok) => tok.type === TokenType.Quote)).toBe(true);
        });

        test('exception rule', () => {
            const input = '@@||example.com^$document';
            const t = tokenize(input);
            const tokens = extractTokens(t);
            expect(tokens[0]).toEqual({ type: TokenType.AtSign, value: '@' });
            expect(tokens[1]).toEqual({ type: TokenType.AtSign, value: '@' });
        });

        test('mixed symbols and identifiers', () => {
            const input = 'test-value_123.foo@bar+more';
            const t = tokenize(input);
            const tokens = extractTokens(t);
            expect(tokens.some((tok) => tok.type === TokenType.Letter)).toBe(true);
            expect(tokens.some((tok) => tok.type === TokenType.Dot)).toBe(true);
            expect(tokens.some((tok) => tok.type === TokenType.AtSign)).toBe(true);
            expect(tokens.some((tok) => tok.type === TokenType.PlusSign)).toBe(true);
        });
    });

    describe('Edge Cases', () => {
        test('very long identifier', () => {
            const input = 'a'.repeat(1000);
            const t = tokenize(input);
            expect(t.tokenCount).toBe(1);
            expect(t.types[0]).toBe(TokenType.Letter);
        });

        test('only whitespace', () => {
            const input = '     \t\t   ';
            const t = tokenize(input);
            expect(t.tokenCount).toBe(1);
            expect(t.types[0]).toBe(TokenType.Whitespace);
        });

        test('alternating tokens and whitespace', () => {
            const input = 'a b c d e';
            const t = tokenize(input);
            expect(t.tokenCount).toBe(9);
            const types = Array.from(t.types.slice(0, t.tokenCount));
            expect(types.filter((ty) => ty === TokenType.Letter)).toHaveLength(5);
            expect(types.filter((ty) => ty === TokenType.Whitespace)).toHaveLength(4);
        });

        test('all escaped characters', () => {
            const input = '\\a\\b\\c\\d';
            const t = tokenize(input);
            expect(t.tokenCount).toBe(4);
            expect(Array.from(t.types.slice(0, 4))).toEqual([
                TokenType.Escaped,
                TokenType.Escaped,
                TokenType.Escaped,
                TokenType.Escaped,
            ]);
        });
    });
});
