import { ErrorMessage } from '../../src/common/enums/error-messages';
import { tokenize } from '../../src/css-tokenizer';
import type { ErrorData } from '../helpers/test-interfaces';

describe('onError callback', () => {
    test.each([
        {
            actual: '\\\n',
            expected: [
                [ErrorMessage.InvalidEscapeSequence, 0, 1],
            ],
        },
        {
            actual: '/** unclosed comment',
            expected: [
                [ErrorMessage.UnterminatedComment, 0, 18],
            ],
        },
        {
            actual: '"eof in string',
            expected: [
                [ErrorMessage.UnexpectedEofInString, 0, 14],
            ],
        },
        {
            actual: '"eof in string\\',
            expected: [
                [ErrorMessage.UnexpectedEofInString, 0, 15],
            ],
        },
        {
            actual: '"newline in string\n',
            expected: [
                [ErrorMessage.UnexpectedNewlineInString, 0, 19],
            ],
        },
        {
            actual: 'url(eof-in-url',
            expected: [
                [ErrorMessage.UnexpectedEofInUrl, 0, 14],
            ],
        },
        {
            actual: 'url(  ',
            expected: [
                [ErrorMessage.UnexpectedEofInUrl, 0, 6],
            ],
        },
        {
            actual: 'url(a a)',
            expected: [
                [ErrorMessage.UnexpectedCharInUrl, 0, 6],
            ],
        },
        {
            actual: 'url(aa"',
            expected: [
                [ErrorMessage.UnexpectedCharInUrl, 0, 6],
            ],
        },
        {
            actual: "url(aa'",
            expected: [
                [ErrorMessage.UnexpectedCharInUrl, 0, 6],
            ],
        },
        {
            actual: 'url(\\\n',
            expected: [
                [ErrorMessage.UnexpectedCharInUrl, 0, 4],
            ],
        },
    ])("should report error for '$actual'", ({ actual, expected }) => {
        const errors: ErrorData[] = [];
        tokenize(actual, () => {}, (...args) => errors.push(args));
        expect(errors).toEqual(expected);
    });
});
