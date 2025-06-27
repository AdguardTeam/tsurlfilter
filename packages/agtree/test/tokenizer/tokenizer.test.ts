import { describe, test, expect } from 'vitest';

import { tokenize, TokenType } from '../../src/tokenizer/tokenizer';

type TokenResult = {
    type: TokenType;
    value: string;
};

const runTokenizer = (input: string): TokenResult[] => {
    const results: TokenResult[] = [];
    tokenize(input, (type, start, end) => {
        results.push({
            type,
            value: input.slice(start, end),
        });
    });
    return results;
};

describe('Tokenizer', () => {
    test('EOF', () => {
        const tokens = runTokenizer('');
        expect(tokens).toEqual([{ type: TokenType.Eof, value: '' }]);
    });

    test('Whitespace and LineBreak', () => {
        const tokens = runTokenizer(' \t\r\n\n\r\f');
        expect(tokens).toEqual([
            { type: TokenType.Whitespace, value: ' \t' },
            { type: TokenType.LineBreak, value: '\r\n' },
            { type: TokenType.LineBreak, value: '\n' },
            { type: TokenType.LineBreak, value: '\r' },
            { type: TokenType.LineBreak, value: '\f' },
            { type: TokenType.Eof, value: '' },
        ]);
    });

    test('Escaped characters', () => {
        const tokens = runTokenizer('\\n \\\\');
        expect(tokens.map((t) => t.type)).toContain(TokenType.Escaped);
    });

    test('Identifiers', () => {
        const tokens = runTokenizer('abc A_B-123');
        expect(tokens.filter((t) => t.type === TokenType.Ident).length).toBe(2);
    });

    test('Cosmetic separator variants with raw content', () => {
        const inputs = ['##div', '#?#div', '#$#div', '#$?#div', '#@#div', '#@?#div', '#@$#div', '#@$?#div'];

        for (const input of inputs) {
            const tokens = runTokenizer(input);
            expect(tokens[0].type).toBe(
                input.startsWith('#@') ? TokenType.AllowlistCosmeticSeparator : TokenType.CosmeticSeparator,
            );
            expect(tokens[1].type).toBe(TokenType.RawContent);
        }
    });

    test('Cosmetic separators with content to be tokenized (cosmeticRule true)', () => {
        const tokens = runTokenizer('#%#div $');
        expect(tokens[0].type).toBe(TokenType.CosmeticSeparator);
        expect(tokens[1].type).toBe(TokenType.Ident);
        expect(tokens[2].type).toBe(TokenType.Whitespace);
        expect(tokens[3].type).toBe(TokenType.DollarSign);
    });

    test('Symbols and punctuation', () => {
        const input = '= / , ( ) { } [ ] | @ * \' " ! + & ~';
        const types = [
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
            TokenType.Eof,
        ];

        const tokens = runTokenizer(input);
        const tokenTypes = tokens.map((t) => t.type).filter((t) => t !== TokenType.Whitespace);
        expect(tokenTypes).toEqual(types);
    });

    test('DollarSign & AllowlistCosmeticSeparator logic', () => {
        const inputs = ['$', '$$', '$@$'];
        const expected = [
            TokenType.DollarSign,

            // $$ considered as a cosmetic separator
            TokenType.CosmeticSeparator,

            // Since we already have a cosmetic separator, next characters should be tokenized as raw content
            TokenType.RawContent,
        ];

        const types = runTokenizer(inputs.join(' '))
            .map((t) => t.type)
            .filter((t) => t !== TokenType.Whitespace);

        expect(types).toEqual([...expected, TokenType.Eof]);
    });

    test('Jump, Skip, and Stop functions', () => {
        let calls = 0;
        tokenize('abc\ndef\nghi', (type, start, end, stop, skip, jump) => {
            calls += 1;
            if (type === TokenType.Ident && start === 0) jump(4); // Jump to after \n
            if (type === TokenType.Ident && start > 4) stop(); // Stop early
            skip(); // Skip the last rule
        });
        expect(calls).toBeLessThan(5);
    });

    test('Default fallback Symbol token', () => {
        const tokens = runTokenizer('%');
        expect(tokens[0].type).toBe(TokenType.Symbol);
    });

    test('Comprehensive cosmetic rule line', () => {
        const input = 'example.com,~example.net#$#body { padding: 0; }';
        const tokens = runTokenizer(input);
        expect(tokens[0].type).toBe(TokenType.Ident);
        expect(tokens.find((t) => t.type === TokenType.CosmeticSeparator)).toBeTruthy();
        expect(tokens.find((t) => t.type === TokenType.RawContent)).toBeTruthy();
    });

    test('Complex mixed input', () => {
        const input = '@@||example.org^$replace=/(<VAST[\\s\\S]*?>)[\\s\\S]*<\\/VAST>/v\\$1<\\/VAST>/i';
        const tokens = runTokenizer(input);
        expect(tokens).toEqual([
            { type: TokenType.AtSign, value: '@' },
            { type: TokenType.AtSign, value: '@' },
            { type: TokenType.Pipe, value: '|' },
            { type: TokenType.Pipe, value: '|' },
            { type: TokenType.Ident, value: 'example' },
            { type: TokenType.Dot, value: '.' },
            { type: TokenType.Ident, value: 'org' },
            { type: TokenType.Caret, value: '^' },
            { type: TokenType.DollarSign, value: '$' },
            { type: TokenType.Ident, value: 'replace' },
            { type: TokenType.EqualsSign, value: '=' },
            { type: TokenType.Slash, value: '/' },
            { type: TokenType.OpenParen, value: '(' },
            { type: TokenType.Symbol, value: '<' },
            { type: TokenType.Ident, value: 'VAST' },
            { type: TokenType.OpenSquare, value: '[' },
            { type: TokenType.Escaped, value: '\\s' },
            { type: TokenType.Escaped, value: '\\S' },
            { type: TokenType.CloseSquare, value: ']' },
            { type: TokenType.Asterisk, value: '*' },
            { type: TokenType.Symbol, value: '?' },
            { type: TokenType.Symbol, value: '>' },
            { type: TokenType.CloseParen, value: ')' },
            { type: TokenType.OpenSquare, value: '[' },
            { type: TokenType.Escaped, value: '\\s' },
            { type: TokenType.Escaped, value: '\\S' },
            { type: TokenType.CloseSquare, value: ']' },
            { type: TokenType.Asterisk, value: '*' },
            { type: TokenType.Symbol, value: '<' },
            { type: TokenType.Escaped, value: '\\/' },
            { type: TokenType.Ident, value: 'VAST' },
            { type: TokenType.Symbol, value: '>' },
            { type: TokenType.Slash, value: '/' },
            { type: TokenType.Ident, value: 'v' },
            { type: TokenType.Escaped, value: '\\$' },
            { type: TokenType.Ident, value: '1' },
            { type: TokenType.Symbol, value: '<' },
            { type: TokenType.Escaped, value: '\\/' },
            { type: TokenType.Ident, value: 'VAST' },
            { type: TokenType.Symbol, value: '>' },
            { type: TokenType.Slash, value: '/' },
            { type: TokenType.Ident, value: 'i' },
            { type: TokenType.Eof, value: '' },
        ]);
    });
});
