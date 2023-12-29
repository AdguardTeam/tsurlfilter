import { TokenType, getFormattedTokenName } from '@adguard/css-tokenizer';
import { sprintf } from 'sprintf-js';

import { END_OF_INPUT, ERROR_MESSAGES } from '../../../src/parser/css/constants';
import { CssTokenStream } from '../../../src/parser/css/css-token-stream';

describe('CssTokenStream', () => {
    test('length', () => {
        const stream = new CssTokenStream('ident 2');
        expect(stream.length).toBe(3); // ident, whitespace, number
    });

    test('advance & isEof', () => {
        const stream = new CssTokenStream('ident 2');

        for (let i = 0; i < stream.length; i += 1) {
            expect(stream.isEof()).toBe(false);
            stream.advance();
        }

        expect(stream.isEof()).toBe(true);

        // if we are out of bounds (EOF, for example), then advance should return undefined
        expect(stream.advance()).toBeUndefined();
    });

    test('fragment', () => {
        const stream = new CssTokenStream('ident 2');
        expect(stream.fragment()).toBe('ident');
        stream.advance();
        expect(stream.fragment()).toBe(' ');
        stream.advance();
        expect(stream.fragment()).toBe('2');

        // if we are out of bounds (EOF, for example), then an empty string should be returned
        stream.advance();
        expect(stream.fragment()).toBe('');
    });

    test('lookahead & lookbehind', () => {
        // ident, whitespace, number
        const stream = new CssTokenStream('ident 2');
        expect(stream.lookahead()).toMatchObject({ type: TokenType.Whitespace });
        expect(stream.lookahead(2)).toMatchObject({ type: TokenType.Number });
        expect(stream.lookbehind()).toBeUndefined(); // no previous token
        expect(stream.lookbehind(2)).toBeUndefined(); // no previous token
        stream.advance(); // eat ident
        expect(stream.lookahead()).toMatchObject({ type: TokenType.Number });
        expect(stream.lookbehind()).toMatchObject({ type: TokenType.Ident });
        stream.advance(); // eat whitespace
        expect(stream.lookahead()).toBeUndefined(); // no next token
        expect(stream.lookahead(2)).toBeUndefined(); // no next token
        expect(stream.lookbehind()).toMatchObject({ type: TokenType.Whitespace });
        expect(stream.lookbehind(2)).toMatchObject({ type: TokenType.Ident });
    });

    test('lookbehindForNonWs', () => {
        // ident, whitespace, number
        const stream = new CssTokenStream('ident \t2');
        expect(stream.lookbehindForNonWs()).toBeUndefined();
        stream.advance(); // eat ident
        stream.advance(); // eat whitespace
        expect(stream.lookbehindForNonWs()).toMatchObject({ type: TokenType.Ident });
    });

    test('get & skipWhitespace', () => {
        // ident, whitespace, number
        const stream = new CssTokenStream('ident 2');
        expect(stream.get()).toMatchObject({ type: TokenType.Ident });
        stream.advance(); // eat ident
        stream.skipWhitespace();
        expect(stream.get()).toMatchObject({ type: TokenType.Number });
    });

    test('getOrFail', () => {
        const stream = new CssTokenStream('ident');
        stream.advance(); // eat ident
        expect(() => stream.getOrFail()).toThrow(
            sprintf(
                ERROR_MESSAGES.EXPECTED_ANY_TOKEN_BUT_GOT,
                END_OF_INPUT,
            ),
        );
    });

    test('skipUntilBalanced', () => {
        const stream = new CssTokenStream('div { padding: 0; }');
        stream.advance(); // eat div
        stream.advance(); // eat whitespace
        stream.advance(); // eat {
        stream.skipUntilBalanced();
        expect(stream.get()).toMatchObject({ type: TokenType.CloseCurlyBracket });

        stream.advance(); // eat }
        // if we already reached the end of input, then skipUntilBalanced should return 0
        expect(stream.skipUntilBalanced()).toBe(0);
    });

    test('skipUntil', () => {
        // ident, whitespace, number
        const stream = new CssTokenStream('ident 2');
        // current token is the ident, skip until the next number
        stream.skipUntil(TokenType.Number);
        expect(stream.get()).toMatchObject({ type: TokenType.Number });
    });

    test('skipUntil with balance', () => {
        const stream = new CssTokenStream('ident;{padding: 0;}');
        stream.skipUntil(TokenType.Semicolon, 1); // skip until the next semicolon with balance 1
        expect(stream.get()).toMatchObject({ type: TokenType.Semicolon });
        expect(stream.lookahead()).toMatchObject({ type: TokenType.CloseCurlyBracket }); // not the first semicolon
    });

    test('skipUntilEx', () => {
        // ident, whitespace, number
        const stream = new CssTokenStream('ident 2');
        stream.advance(); // eat ident
        stream.advance(); // eat whitespace
        const { skipped, skippedTrimmed } = stream.skipUntilEx(TokenType.Ident, 0);
        expect(skipped).toBe(1);
        expect(skippedTrimmed).toBe(1);
    });

    test('expectNotEof', () => {
        const stream = new CssTokenStream('ident');
        expect(() => stream.expectNotEof()).not.toThrow();
        stream.advance();
        expect(() => stream.expectNotEof()).toThrow();
    });

    test('expect with balance and value', () => {
        const stream = new CssTokenStream('ident');
        expect(() => stream.expect(TokenType.Ident, { balance: 0, value: 'ident' })).not.toThrow();

        // Invalid balance
        expect(() => stream.expect(TokenType.Ident, { balance: 1, value: 'ident' })).toThrow(
            sprintf(
                ERROR_MESSAGES.EXPECTED_TOKEN_WITH_BALANCE_BUT_GOT,
                getFormattedTokenName(TokenType.Ident),
                1,
                0,
            ),
        );

        // Invalid value
        expect(() => stream.expect(TokenType.Ident, { balance: 0, value: 'ident2' })).toThrow(
            sprintf(
                ERROR_MESSAGES.EXPECTED_TOKEN_WITH_VALUE_BUT_GOT,
                getFormattedTokenName(TokenType.Ident),
                'ident2',
                'ident',
            ),
        );
    });

    test('expect with balance and value', () => {
        const stream = new CssTokenStream('ident');
        expect(() => stream.expect(TokenType.Ident, { balance: 0, value: 'ident' })).not.toThrow();
        stream.advance();
        expect(() => stream.expect(TokenType.Ident, { balance: 0, value: 'ident' })).toThrow();
    });

    test('getBalance', () => {
        const stream = new CssTokenStream('ident');
        expect(stream.getBalance()).toBe(0);
        stream.advance();
        expect(stream.getBalance()).toBe(0);
    });

    describe('hasAnySelectorExtendedCssNode', () => {
        test.each([
            [String.raw`div`, false],
            [String.raw`div > a`, false],
            [String.raw`[attr] > a:hover`, false],

            [String.raw`:contains(a)`, true],
            [String.raw`[-ext-contains="a"]`, true],
            [String.raw`[-abp-contains="a"]`, true],
        ])("should return '%s' for '%s'", (input, expected) => {
            const stream = new CssTokenStream(input);
            expect(stream.hasAnySelectorExtendedCssNode()).toBe(expected);
        });
    });
});
