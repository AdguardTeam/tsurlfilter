import { describe, expect, test } from 'vitest';

import { cssTrivialTokenLength } from '../../../src/css/tokenizer/css-token-mapping';
import { TokenType } from '../../../src/tokenizer/token-types';

describe('cssTrivialTokenLength', () => {
    test.each([
        [TokenType.Colon, 'Colon'],
        [TokenType.Semicolon, 'Semicolon'],
        [TokenType.Comma, 'Comma'],
        [TokenType.OpenParen, 'OpenParen'],
        [TokenType.CloseParen, 'CloseParen'],
        [TokenType.OpenSquare, 'OpenSquare'],
        [TokenType.CloseSquare, 'CloseSquare'],
        [TokenType.OpenBrace, 'OpenBrace'],
        [TokenType.CloseBrace, 'CloseBrace'],
    ])('returns 1 for %s (%i)', (tokenType) => {
        const types = new Uint8Array([tokenType]);
        expect(cssTrivialTokenLength(types, 0, 1)).toBe(1);
    });

    test.each([
        [TokenType.Letter, 'Letter'],
        [TokenType.Digit, 'Digit'],
        [TokenType.Whitespace, 'Whitespace'],
        [TokenType.Escaped, 'Escaped'],
        [TokenType.Slash, 'Slash'],
        [TokenType.Asterisk, 'Asterisk'],
        [TokenType.AtSign, 'AtSign'],
        [TokenType.HashMark, 'HashMark'],
        [TokenType.Quote, 'Quote'],
        [TokenType.Apostrophe, 'Apostrophe'],
        [TokenType.Dot, 'Dot'],
        [TokenType.Hyphen, 'Hyphen'],
        [TokenType.PlusSign, 'PlusSign'],
        [TokenType.Percent, 'Percent'],
    ])('returns 0 for %s (%i)', (tokenType) => {
        const types = new Uint8Array([tokenType]);
        expect(cssTrivialTokenLength(types, 0, 1)).toBe(0);
    });
});
