import {
    describe,
    expect,
    it,
    type MockedFunction,
    test,
    vi,
} from 'vitest';

import { hasToken } from '../../src/utils/has-token';
import { tokenizeExtended } from '../../src/extended-css-tokenizer';
import { TokenType } from '../../src/common/enums/token-types';
import { type OnTokenCallback } from '../../src/common/types/function-prototypes';

const SAMPLE_CSS = '{ color: red; }';

describe('OnTokenCallback', () => {
    it('calls the callback with the expected token types in sequence', () => {
        const mockCallback = vi.fn();

        tokenizeExtended(SAMPLE_CSS, mockCallback);

        const tokenTypes = mockCallback.mock.calls.map((callArgs) => callArgs[0]);

        expect(tokenTypes).toEqual([
            TokenType.OpenCurlyBracket,
            TokenType.Whitespace,
            TokenType.Ident,
            TokenType.Colon,
            TokenType.Whitespace,
            TokenType.Ident,
            TokenType.Semicolon,
            TokenType.Whitespace,
            TokenType.CloseCurlyBracket,
        ]);
    });

    it('stops the tokenization when the callback calls the stop function', () => {
        const mockCallback: MockedFunction<OnTokenCallback> = vi.fn((type, _start, _end, _props, stop) => {
            if (type === TokenType.Ident) {
                stop();
            }
        });

        tokenizeExtended(SAMPLE_CSS, mockCallback);

        const tokenTypes = mockCallback.mock.calls.map((callArgs) => callArgs[0]);

        expect(tokenTypes).toEqual([
            TokenType.OpenCurlyBracket,
            TokenType.Whitespace,
            TokenType.Ident,
        ]);
    });
});

describe('hasToken', () => {
    test.each([
        {
            description: 'empty string with Ident token set',
            raw: '',
            tokens: new Set([TokenType.Ident]),
            expected: false,
        },
        {
            description: 'string of CloseCurlyBracket token set',
            raw: ' {  }  ',
            tokens: new Set([TokenType.CloseCurlyBracket]),
            expected: true,
        },
        {
            description: 'simple at-keyword "@import" with AtKeyword token',
            raw: '@import',
            tokens: new Set([TokenType.AtKeyword]),
            expected: true,
        },
        {
            description: 'missing a semicolon -> only AtKeyword, no Semicolon token found',
            raw: '@import',
            tokens: new Set([TokenType.Semicolon]),
            expected: false,
        },
    ])('should return $expected when $description', ({ raw, tokens, expected }) => {
        const result = hasToken(raw, tokens, tokenizeExtended);
        expect(result).toBe(expected);
    });
});
