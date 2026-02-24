import { describe, test, expect } from 'vitest';

import { tokenizeLine } from '../../src/tokenizer/tokenizer';
import { TokenType } from '../../src/tokenizer/token-types';
import type { TokenizeResult } from '../../src/tokenizer/tokenizer';

type TokenResult = {
    type: TokenType;
    value: string;
};

const createResult = (capacity = 1024): TokenizeResult => ({
    tokenCount: 0,
    types: new Uint8Array(capacity),
    ends: new Uint32Array(capacity),
    actualEnd: 0,
    overflowed: 0,
});

const extractTokens = (source: string, result: TokenizeResult, start = 0): TokenResult[] => {
    const tokens: TokenResult[] = [];
    let prevEnd = start;

    for (let i = 0; i < result.tokenCount; i += 1) {
        tokens.push({
            type: result.types[i],
            value: source.slice(prevEnd, result.ends[i]),
        });
        prevEnd = result.ends[i];
    }

    return tokens;
};

describe('tokenizeLine', () => {
    describe('Basic Token Types', () => {
        test('empty string', () => {
            const result = createResult();
            tokenizeLine('', 0, result);

            expect(result.tokenCount).toBe(0);
            expect(result.actualEnd).toBe(0);
            expect(result.overflowed).toBe(0);
        });

        test('single-character tokens', () => {
            const result = createResult();
            const input = '=/,(){}[]|@*\'"!+&~.;:#$?%';
            tokenizeLine(input, 0, result);

            const tokens = extractTokens(input, result);
            expect(tokens.map((t) => t.type)).toEqual([
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
            const result = createResult();
            const input = 'a \t  b';
            tokenizeLine(input, 0, result);

            const tokens = extractTokens(input, result);
            expect(tokens).toEqual([
                { type: TokenType.Ident, value: 'a' },
                { type: TokenType.Whitespace, value: ' \t  ' },
                { type: TokenType.Ident, value: 'b' },
            ]);
        });

        test('identifiers with alphanumeric, dash, and underscore', () => {
            const result = createResult();
            const input = 'abc123 A_B-C test-123_xyz';
            tokenizeLine(input, 0, result);

            const tokens = extractTokens(input, result);
            const idents = tokens.filter((t) => t.type === TokenType.Ident);
            expect(idents).toEqual([
                { type: TokenType.Ident, value: 'abc123' },
                { type: TokenType.Ident, value: 'A_B-C' },
                { type: TokenType.Ident, value: 'test-123_xyz' },
            ]);
        });

        test('escaped characters', () => {
            const result = createResult();
            const input = '\\n\\t\\\\\\$';
            tokenizeLine(input, 0, result);

            const tokens = extractTokens(input, result);
            expect(tokens).toEqual([
                { type: TokenType.Escaped, value: '\\n' },
                { type: TokenType.Escaped, value: '\\t' },
                { type: TokenType.Escaped, value: '\\\\' },
                { type: TokenType.Escaped, value: '\\$' },
            ]);
        });

        test('backslash at end of line becomes symbol', () => {
            const result = createResult();
            const input = 'test\\';
            tokenizeLine(input, 0, result);

            const tokens = extractTokens(input, result);
            expect(tokens[1]).toEqual({ type: TokenType.Symbol, value: '\\' });
        });

        test('symbol fallback for non-mapped ASCII characters', () => {
            const result = createResult();
            const input = '<>`';
            tokenizeLine(input, 0, result);

            const tokens = extractTokens(input, result);
            tokens.forEach((token) => {
                expect(token.type).toBe(TokenType.Symbol);
            });
        });

        test('non-ASCII characters as symbols', () => {
            const result = createResult();
            const input = 'test😀你好';
            tokenizeLine(input, 0, result);

            const tokens = extractTokens(input, result);
            expect(tokens.length).toBeGreaterThan(1);
            expect(tokens.some((t) => t.type === TokenType.Symbol)).toBe(true);
        });
    });

    describe('Line Break Handling', () => {
        test('stops at LF (\\n)', () => {
            const result = createResult();
            const input = 'abc\ndef';
            tokenizeLine(input, 0, result);

            expect(result.actualEnd).toBe(3);
            expect(extractTokens(input, result)).toEqual([
                { type: TokenType.Ident, value: 'abc' },
            ]);
        });

        test('stops at CR (\\r)', () => {
            const result = createResult();
            const input = 'test\rmore';
            tokenizeLine(input, 0, result);

            expect(result.actualEnd).toBe(4);
            expect(extractTokens(input, result)).toEqual([
                { type: TokenType.Ident, value: 'test' },
            ]);
        });

        test('stops at CRLF (\\r\\n)', () => {
            const result = createResult();
            const input = 'first\r\nsecond';
            tokenizeLine(input, 0, result);

            expect(result.actualEnd).toBe(5);
            expect(extractTokens(input, result)).toEqual([
                { type: TokenType.Ident, value: 'first' },
            ]);
        });
    });

    describe('Start Position', () => {
        test('tokenizes from middle of string', () => {
            const result = createResult();
            const input = 'skip this|parse this';
            tokenizeLine(input, 10, result);

            const tokens = extractTokens(input, result, 10);
            expect(tokens[0]).toEqual({ type: TokenType.Ident, value: 'parse' });
        });

        test('respects start position with line breaks', () => {
            const result = createResult();
            const input = 'line1\nline2\nline3';
            tokenizeLine(input, 6, result);

            expect(result.actualEnd).toBe(11);
            expect(extractTokens(input, result, 6)).toEqual([
                { type: TokenType.Ident, value: 'line2' },
            ]);
        });
    });

    describe('Buffer Overflow', () => {
        test('sets overflow flag when buffer is full', () => {
            const result = createResult(5);
            const input = 'a b c d e f g';
            tokenizeLine(input, 0, result);

            expect(result.overflowed).toBe(1);
            expect(result.tokenCount).toBeLessThanOrEqual(5);
        });

        test('does not overflow with exact capacity', () => {
            const result = createResult(100);
            const input = 'a b c';
            tokenizeLine(input, 0, result);

            expect(result.overflowed).toBe(0);
        });

        test('overflow stops at safe boundary', () => {
            const result = createResult(10);
            const input = 'a'.repeat(100);
            tokenizeLine(input, 0, result);

            expect(result.overflowed).toBe(1);
            const beforeOverflow = result.actualEnd;

            tokenizeLine(input, 0, result);
            expect(result.actualEnd).toBe(beforeOverflow);
        });
    });

    describe('Buffer Reuse (Critical Memory Behavior)', () => {
        test('overwrites previous tokens in buffer', () => {
            const result = createResult();

            tokenizeLine('first|test', 0, result);
            const firstTokenCount = result.tokenCount;
            expect(firstTokenCount).toBeGreaterThan(0);

            tokenizeLine('abc', 0, result);
            expect(result.tokenCount).toBe(1);
            expect(result.types[0]).toBe(TokenType.Ident);
            expect(result.ends[0]).toBe(3);
        });

        test('buffer data from previous call is lost', () => {
            const result = createResult();

            tokenizeLine('example.com', 0, result);
            const firstTypes = Array.from(result.types.slice(0, result.tokenCount));

            tokenizeLine('test', 0, result);
            const secondTypes = Array.from(result.types.slice(0, result.tokenCount));

            expect(firstTypes).not.toEqual(secondTypes);
        });

        test('resets overflow flag on each call', () => {
            const result = createResult(70);

            tokenizeLine('a b c d e f g h i j k', 0, result);
            expect(result.overflowed).toBe(1);

            tokenizeLine('abc', 0, result);
            expect(result.overflowed).toBe(0);
        });
    });

    describe('Complex Real-World Patterns', () => {
        test('domain pattern', () => {
            const result = createResult();
            const input = 'example.com';
            tokenizeLine(input, 0, result);

            expect(extractTokens(input, result)).toEqual([
                { type: TokenType.Ident, value: 'example' },
                { type: TokenType.Dot, value: '.' },
                { type: TokenType.Ident, value: 'com' },
            ]);
        });

        test('filter rule with options', () => {
            const result = createResult();
            const input = '||example.org^$third-party,domain=test.com';
            tokenizeLine(input, 0, result);

            const tokens = extractTokens(input, result);
            expect(tokens[0]).toEqual({ type: TokenType.Pipe, value: '|' });
            expect(tokens.some((t) => t.type === TokenType.Caret)).toBe(true);
            expect(tokens.some((t) => t.type === TokenType.DollarSign)).toBe(true);
            expect(tokens.some((t) => t.type === TokenType.Comma)).toBe(true);
        });

        test('regex pattern with escapes', () => {
            const result = createResult();
            const input = '/ad[\\s\\S]*banner/i';
            tokenizeLine(input, 0, result);

            const tokens = extractTokens(input, result);
            expect(tokens.filter((t) => t.type === TokenType.Escaped).length).toBe(2);
            expect(tokens.some((t) => t.type === TokenType.OpenSquare)).toBe(true);
            expect(tokens.some((t) => t.type === TokenType.CloseSquare)).toBe(true);
        });

        test('CSS selector pattern', () => {
            const result = createResult();
            const input = 'div[class*="ad"]';
            tokenizeLine(input, 0, result);

            const tokens = extractTokens(input, result);
            expect(tokens[0]).toEqual({ type: TokenType.Ident, value: 'div' });
            expect(tokens.some((t) => t.type === TokenType.Asterisk)).toBe(true);
            expect(tokens.some((t) => t.type === TokenType.Quote)).toBe(true);
        });

        test('exception rule', () => {
            const result = createResult();
            const input = '@@||example.com^$document';
            tokenizeLine(input, 0, result);

            const tokens = extractTokens(input, result);
            expect(tokens[0]).toEqual({ type: TokenType.AtSign, value: '@' });
            expect(tokens[1]).toEqual({ type: TokenType.AtSign, value: '@' });
        });

        test('mixed symbols and identifiers', () => {
            const result = createResult();
            const input = 'test-value_123.foo@bar+more';
            tokenizeLine(input, 0, result);

            const tokens = extractTokens(input, result);
            expect(tokens.some((t) => t.type === TokenType.Ident)).toBe(true);
            expect(tokens.some((t) => t.type === TokenType.Dot)).toBe(true);
            expect(tokens.some((t) => t.type === TokenType.AtSign)).toBe(true);
            expect(tokens.some((t) => t.type === TokenType.PlusSign)).toBe(true);
        });
    });

    describe('Edge Cases', () => {
        test('very long identifier', () => {
            const result = createResult();
            const input = 'a'.repeat(1000);
            tokenizeLine(input, 0, result);

            expect(result.tokenCount).toBe(1);
            expect(result.types[0]).toBe(TokenType.Ident);
            expect(result.ends[0]).toBe(1000);
        });

        test('only whitespace', () => {
            const result = createResult();
            const input = '     \t\t   ';
            tokenizeLine(input, 0, result);

            expect(result.tokenCount).toBe(1);
            expect(result.types[0]).toBe(TokenType.Whitespace);
        });

        test('alternating tokens and whitespace', () => {
            const result = createResult();
            const input = 'a b c d e';
            tokenizeLine(input, 0, result);

            expect(result.tokenCount).toBe(9);
            const types = Array.from(result.types.slice(0, result.tokenCount));
            expect(types.filter((t) => t === TokenType.Ident)).toHaveLength(5);
            expect(types.filter((t) => t === TokenType.Whitespace)).toHaveLength(4);
        });

        test('all escaped characters', () => {
            const result = createResult();
            const input = '\\a\\b\\c\\d';
            tokenizeLine(input, 0, result);

            expect(result.tokenCount).toBe(4);
            expect(Array.from(result.types.slice(0, 4))).toEqual([
                TokenType.Escaped,
                TokenType.Escaped,
                TokenType.Escaped,
                TokenType.Escaped,
            ]);
        });

        test('start position at end of string', () => {
            const result = createResult();
            const input = 'test';
            tokenizeLine(input, 4, result);

            expect(result.tokenCount).toBe(0);
            expect(result.actualEnd).toBe(4);
        });

        test('start position beyond string length', () => {
            const result = createResult();
            const input = 'test';
            tokenizeLine(input, 100, result);

            expect(result.tokenCount).toBe(0);
            expect(result.actualEnd).toBe(100);
        });
    });
});
