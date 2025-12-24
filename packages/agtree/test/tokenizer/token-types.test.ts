import { describe, test, expect } from 'vitest';

import { TokenType, getBaseTokenName, getFormattedTokenName } from '../../src/tokenizer/token-types';

describe('TokenType', () => {
    test('should have correct numeric values', () => {
        expect(TokenType.Eof).toBe(0);
        expect(TokenType.Whitespace).toBe(1);
        expect(TokenType.LineBreak).toBe(2);
        expect(TokenType.Ident).toBe(4);
        expect(TokenType.Symbol).toBe(31);
    });
});

describe('getBaseTokenName', () => {
    test('should return correct names for known token types', () => {
        expect(getBaseTokenName(TokenType.Eof)).toBe('eof');
        expect(getBaseTokenName(TokenType.Whitespace)).toBe('whitespace');
        expect(getBaseTokenName(TokenType.LineBreak)).toBe('line-break');
        expect(getBaseTokenName(TokenType.Escaped)).toBe('escaped');
        expect(getBaseTokenName(TokenType.Ident)).toBe('ident');
        expect(getBaseTokenName(TokenType.CosmeticSeparator)).toBe('cosmetic-separator');
        expect(getBaseTokenName(TokenType.AllowlistCosmeticSeparator)).toBe('allowlist-cosmetic-separator');
        expect(getBaseTokenName(TokenType.RawContent)).toBe('raw-content');
    });

    test('should return correct names for punctuation tokens', () => {
        expect(getBaseTokenName(TokenType.EqualsSign)).toBe('=');
        expect(getBaseTokenName(TokenType.Slash)).toBe('/');
        expect(getBaseTokenName(TokenType.DollarSign)).toBe('$');
        expect(getBaseTokenName(TokenType.Comma)).toBe(',');
        expect(getBaseTokenName(TokenType.OpenParen)).toBe('(');
        expect(getBaseTokenName(TokenType.CloseParen)).toBe(')');
        expect(getBaseTokenName(TokenType.OpenBrace)).toBe('{');
        expect(getBaseTokenName(TokenType.CloseBrace)).toBe('}');
        expect(getBaseTokenName(TokenType.OpenSquare)).toBe('[');
        expect(getBaseTokenName(TokenType.CloseSquare)).toBe(']');
        expect(getBaseTokenName(TokenType.Pipe)).toBe('|');
        expect(getBaseTokenName(TokenType.AtSign)).toBe('@');
        expect(getBaseTokenName(TokenType.Asterisk)).toBe('*');
        expect(getBaseTokenName(TokenType.Quote)).toBe('"');
        expect(getBaseTokenName(TokenType.Apostrophe)).toBe("'");
        expect(getBaseTokenName(TokenType.ExclamationMark)).toBe('!');
        expect(getBaseTokenName(TokenType.HashMark)).toBe('#');
        expect(getBaseTokenName(TokenType.PlusSign)).toBe('+');
        expect(getBaseTokenName(TokenType.AndSign)).toBe('&');
        expect(getBaseTokenName(TokenType.Tilde)).toBe('~');
        expect(getBaseTokenName(TokenType.Caret)).toBe('^');
        expect(getBaseTokenName(TokenType.Dot)).toBe('.');
        expect(getBaseTokenName(TokenType.Semicolon)).toBe(';');
        expect(getBaseTokenName(TokenType.Symbol)).toBe('symbol');
    });

    test('should return "unknown" for invalid token types', () => {
        expect(getBaseTokenName(-1 as TokenType)).toBe('unknown');
        expect(getBaseTokenName(999 as TokenType)).toBe('unknown');
        expect(getBaseTokenName(32 as TokenType)).toBe('unknown');
    });

    test('should have names for all token types (0-31)', () => {
        for (let i = 0; i <= 31; i += 1) {
            const name = getBaseTokenName(i as TokenType);
            expect(name).not.toBe('unknown');
            expect(name).toBeTruthy();
            expect(typeof name).toBe('string');
        }
    });
});

describe('getFormattedTokenName', () => {
    test('should return formatted names for known token types', () => {
        expect(getFormattedTokenName(TokenType.Eof)).toBe('<eof-token>');
        expect(getFormattedTokenName(TokenType.Whitespace)).toBe('<whitespace-token>');
        expect(getFormattedTokenName(TokenType.Ident)).toBe('<ident-token>');
        expect(getFormattedTokenName(TokenType.Symbol)).toBe('<symbol-token>');
    });

    test('should return formatted names for punctuation tokens', () => {
        expect(getFormattedTokenName(TokenType.EqualsSign)).toBe('<=-token>');
        expect(getFormattedTokenName(TokenType.Comma)).toBe('<,-token>');
        expect(getFormattedTokenName(TokenType.OpenParen)).toBe('<(-token>');
        expect(getFormattedTokenName(TokenType.CloseParen)).toBe('<)-token>');
    });

    test('should return "<unknown-token>" for invalid token types', () => {
        expect(getFormattedTokenName(-1 as TokenType)).toBe('<unknown-token>');
        expect(getFormattedTokenName(999 as TokenType)).toBe('<unknown-token>');
        expect(getFormattedTokenName(32 as TokenType)).toBe('<unknown-token>');
    });

    test('should format all valid token types correctly', () => {
        for (let i = 0; i <= 31; i += 1) {
            const formatted = getFormattedTokenName(i as TokenType);
            expect(formatted).toMatch(/^<.+-token>$/);
            expect(formatted).not.toBe('<unknown-token>');
        }
    });
});
