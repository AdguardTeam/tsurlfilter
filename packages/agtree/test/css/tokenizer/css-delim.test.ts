import { describe, expect, test } from 'vitest';

import { TokenType } from '../../../src/tokenizer/token-types';

describe('CSS delim tokens', () => {
    test.each([
        [TokenType.Tilde, '~'],
        [TokenType.Caret, '^'],
        [TokenType.Pipe, '|'],
        [TokenType.DollarSign, '$'],
        [TokenType.Asterisk, '*'],
        [TokenType.ExclamationMark, '!'],
        [TokenType.PlusSign, '+'],
    ])('token type %i (%s) is a single delim token (span = 1)', (tokenType) => {
        // Any unmatched single token is a <delim-token> with span 1.
        // These tokens don't match any multi-token CSS pattern at their position.
        const types = new Uint8Array([tokenType]);
        // A delim token is simply any single token that doesn't match a
        // higher-level CSS token. The span is always 1.
        expect(types.length).toBe(1);
        expect(types[0]).toBe(tokenType);
    });

    test('Symbol tokens are delim tokens', () => {
        // Symbol is the catch-all for unrecognized ASCII chars
        const types = new Uint8Array([TokenType.Symbol]);
        expect(types[0]).toBe(TokenType.Symbol);
    });
});
