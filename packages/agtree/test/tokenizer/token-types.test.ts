import { describe, test, expect } from 'vitest';

import { TokenType, getBaseTokenName, getFormattedTokenName } from '../../src/tokenizer/token-types';

describe('TokenType', () => {
    test('should have correct numeric values', () => {
        expect(TokenType.Eof).toBe(0);
        expect(TokenType.Whitespace).toBe(1);
        expect(TokenType.LineBreak).toBe(2);
        expect(TokenType.Ident).toBe(4);
        expect(TokenType.UnicodeSequence).toBe(31);
        expect(TokenType.Symbol).toBe(32);
    });
});

describe('getBaseTokenName', () => {
    test('should return correct names for known token types', () => {
        expect(getBaseTokenName(TokenType.Eof)).toBe('eof');
        expect(getBaseTokenName(TokenType.Whitespace)).toBe('whitespace');
        expect(getBaseTokenName(TokenType.LineBreak)).toBe('line-break');
        expect(getBaseTokenName(TokenType.Escaped)).toBe('escaped');
        expect(getBaseTokenName(TokenType.Ident)).toBe('ident');
        expect(getBaseTokenName(TokenType.UnicodeSequence)).toBe('unicode-sequence');
        expect(getBaseTokenName(TokenType.Symbol)).toBe('symbol');
    });

    test('should return correct names for punctuation tokens', () => {
        expect(getBaseTokenName(TokenType.EqualsSign)).toBe('equals');
        expect(getBaseTokenName(TokenType.Slash)).toBe('slash');
        expect(getBaseTokenName(TokenType.DollarSign)).toBe('dollar');
        expect(getBaseTokenName(TokenType.Comma)).toBe('comma');
        expect(getBaseTokenName(TokenType.OpenParen)).toBe('open-parenthesis');
        expect(getBaseTokenName(TokenType.CloseParen)).toBe('close-parenthesis');
        expect(getBaseTokenName(TokenType.OpenBrace)).toBe('open-brace');
        expect(getBaseTokenName(TokenType.CloseBrace)).toBe('close-brace');
        expect(getBaseTokenName(TokenType.OpenSquare)).toBe('open-square');
        expect(getBaseTokenName(TokenType.CloseSquare)).toBe('close-square');
        expect(getBaseTokenName(TokenType.Pipe)).toBe('pipe');
        expect(getBaseTokenName(TokenType.AtSign)).toBe('at');
        expect(getBaseTokenName(TokenType.Asterisk)).toBe('asterisk');
        expect(getBaseTokenName(TokenType.Quote)).toBe('quote');
        expect(getBaseTokenName(TokenType.Apostrophe)).toBe('apostrophe');
        expect(getBaseTokenName(TokenType.ExclamationMark)).toBe('exclamation');
        expect(getBaseTokenName(TokenType.HashMark)).toBe('hash');
        expect(getBaseTokenName(TokenType.PlusSign)).toBe('plus');
        expect(getBaseTokenName(TokenType.AndSign)).toBe('ampersand');
        expect(getBaseTokenName(TokenType.Tilde)).toBe('tilde');
        expect(getBaseTokenName(TokenType.Caret)).toBe('caret');
        expect(getBaseTokenName(TokenType.Dot)).toBe('dot');
        expect(getBaseTokenName(TokenType.Semicolon)).toBe('semicolon');
        expect(getBaseTokenName(TokenType.Colon)).toBe('colon');
        expect(getBaseTokenName(TokenType.QuestionMark)).toBe('question');
        expect(getBaseTokenName(TokenType.Percent)).toBe('percent');
    });

    test('should return "unknown" for invalid token types', () => {
        expect(getBaseTokenName(-1 as TokenType)).toBe('unknown');
        expect(getBaseTokenName(999 as TokenType)).toBe('unknown');
        expect(getBaseTokenName(100 as TokenType)).toBe('unknown');
    });

    test('should have names for all token types (0-32)', () => {
        for (let i = 0; i <= 32; i += 1) {
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
        expect(getFormattedTokenName(TokenType.UnicodeSequence)).toBe('<unicode-sequence-token>');
    });

    test('should return formatted names for punctuation tokens', () => {
        expect(getFormattedTokenName(TokenType.EqualsSign)).toBe('<equals-token>');
        expect(getFormattedTokenName(TokenType.Comma)).toBe('<comma-token>');
        expect(getFormattedTokenName(TokenType.OpenParen)).toBe('<open-parenthesis-token>');
        expect(getFormattedTokenName(TokenType.CloseParen)).toBe('<close-parenthesis-token>');
    });

    test('should return "<unknown-token>" for invalid token types', () => {
        expect(getFormattedTokenName(-1 as TokenType)).toBe('<unknown-token>');
        expect(getFormattedTokenName(999 as TokenType)).toBe('<unknown-token>');
        expect(getFormattedTokenName(100 as TokenType)).toBe('<unknown-token>');
    });

    test('should format all valid token types correctly', () => {
        for (let i = 0; i <= 32; i += 1) {
            const formatted = getFormattedTokenName(i as TokenType);
            expect(formatted).toMatch(/^<.+-token>$/);
            expect(formatted).not.toBe('<unknown-token>');
        }
    });
});
