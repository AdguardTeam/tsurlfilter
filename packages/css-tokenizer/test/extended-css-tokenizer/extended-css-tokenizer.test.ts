import { describe, expect, test } from 'vitest';

import { type TokenizerContext } from '../../src/common/context';
import { ErrorMessage } from '../../src/common/enums/error-messages';
import { TokenType } from '../../src/common/enums/token-types';
import { tokenizeExtended } from '../../src/extended-css-tokenizer';
import { getStringHash } from '../../src/utils/djb2';
import type { ErrorData, TokenData } from '../helpers/test-interfaces';

describe('tokenizer', () => {
    // Sometimes the source code contains BOM (Byte Order Mark) at the beginning of the file, it should be skipped.
    test('should skip leading BOM in the extended tokenizer', () => {
        const tokens: TokenData[] = [];
        tokenizeExtended('\uFEFF ', (...args) => tokens.push(args));
        expect(tokens.map(([type, start, end]) => [type, start, end])).toEqual([
            [TokenType.Whitespace, 1, 2],
        ]);
    });

    test('should merge custom handlers in the extended tokenizer', () => {
        const tokens: TokenData[] = [];
        tokenizeExtended(':custom(a)', (...args) => tokens.push(args), () => {}, new Map([
            [getStringHash('custom'), (context: TokenizerContext) => {
                const start = context.offset;
                // this is a simple handler that just consumes one single code point - just for testing purposes
                context.consumeCodePoint();
                context.onToken(TokenType.Delim, start, context.offset, undefined, context.stop);
            }],
        ]));

        expect(tokens.map(([type, start, end]) => [type, start, end])).toEqual([
            [TokenType.Colon, 0, 1],
            [TokenType.Function, 1, 8],
            [TokenType.Delim, 8, 9],
            [TokenType.CloseParenthesis, 9, 10],
        ]);
    });

    test('should handle errors in the extended tokenizer', () => {
        // runs without errors if no error callback function is provided
        tokenizeExtended('"str', () => {});

        // callback function is called with the error
        const errors: ErrorData[] = [];
        tokenizeExtended('"str', () => {}, (...args) => errors.push(args));
        expect(errors).toEqual([
            [ErrorMessage.UnexpectedEofInString, 0, 4],
        ]);
    });
});
