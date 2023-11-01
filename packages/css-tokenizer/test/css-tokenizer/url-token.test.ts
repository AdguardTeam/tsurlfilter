import { CodePoint } from '../../src/common/enums/code-points';
import { TokenType } from '../../src/common/enums/token-types';
import { tokenize } from '../../src/css-tokenizer';
import type { TokenData } from '../helpers/test-interfaces';
import { addAsProp, testTokenization } from '../helpers/test-utils';

describe('URLs', () => {
    describe('should tokenize valid inputs as <url-token>', () => {
        test.each([
            'url(http://example.com)',
            // case-insensitive
            'URL(http://example.com)',
            'url( http://example.com )',
            'url(  http://example.com  )',
            'url(myFont.woff)',
            'url(/media/diamonds.png)',
            // missing closing parenthesis - should be treated as <url-token>, because tokenizer is tolerant
            'url(/media/diamonds.png',
            // escaped parenthesis - if no quotes are used, parenthesis should be escaped
            String.raw`url(myFont\(1\).woff)`,
        ])('should tokenize \'%s\' as <url-token>', (actual) => {
            const tokens: TokenData[] = [];
            tokenize(actual, (...args) => tokens.push(args));
            expect(tokens).toEqual([
                [TokenType.Url, 0, actual.length],
            ]);
        });
    });

    describe('should tokenize url() with string parameter as <function-token>', () => {
        test.each(addAsProp([
            // regular case
            {
                actual: 'url("http://example.com")',
                expected: [
                    [TokenType.Function, 0, 4],
                    [TokenType.String, 4, 24],
                    [TokenType.CloseParenthesis, 24, 25],
                ],
            },
            // single quotes
            {
                actual: "url('http://example.com')",
                expected: [
                    [TokenType.Function, 0, 4],
                    [TokenType.String, 4, 24],
                    [TokenType.CloseParenthesis, 24, 25],
                ],
            },
            // extra whitespace
            {
                actual: 'url( "http://example.com" )',
                expected: [
                    [TokenType.Function, 0, 4],
                    [TokenType.Whitespace, 4, 5],
                    [TokenType.String, 5, 25],
                    [TokenType.Whitespace, 25, 26],
                    [TokenType.CloseParenthesis, 26, 27],
                ],
            },
            {
                actual: "url( 'http://example.com' )",
                expected: [
                    [TokenType.Function, 0, 4],
                    [TokenType.Whitespace, 4, 5],
                    [TokenType.String, 5, 25],
                    [TokenType.Whitespace, 25, 26],
                    [TokenType.CloseParenthesis, 26, 27],
                ],
            },
            // string contains parenthesis
            {
                actual: 'url("myFont(1).woff")',
                expected: [
                    [TokenType.Function, 0, 4],
                    [TokenType.String, 4, 20],
                    [TokenType.CloseParenthesis, 20, 21],
                ],
            },
            // extra whitespace
            {
                actual: 'url( "myFont(1).woff" )',
                expected: [
                    [TokenType.Function, 0, 4],
                    [TokenType.Whitespace, 4, 5],
                    [TokenType.String, 5, 21],
                    [TokenType.Whitespace, 21, 22],
                    [TokenType.CloseParenthesis, 22, 23],
                ],
            },
            {
                actual: 'url(  "myFont(1).woff"  )',
                expected: [
                    [TokenType.Function, 0, 4],
                    [TokenType.Whitespace, 4, 6],
                    [TokenType.String, 6, 22],
                    [TokenType.Whitespace, 22, 24],
                    [TokenType.CloseParenthesis, 24, 25],
                ],
            },
            // same as above, but with single quotes
            {
                actual: "url('myFont(1).woff')",
                expected: [
                    [TokenType.Function, 0, 4],
                    [TokenType.String, 4, 20],
                    [TokenType.CloseParenthesis, 20, 21],
                ],
            },
            // extra whitespace
            {
                actual: "url( 'myFont(1).woff' )",
                expected: [
                    [TokenType.Function, 0, 4],
                    [TokenType.Whitespace, 4, 5],
                    [TokenType.String, 5, 21],
                    [TokenType.Whitespace, 21, 22],
                    [TokenType.CloseParenthesis, 22, 23],
                ],
            },
            {
                actual: "url(  'myFont(1).woff'  )",
                expected: [
                    [TokenType.Function, 0, 4],
                    [TokenType.Whitespace, 4, 6],
                    [TokenType.String, 6, 22],
                    [TokenType.Whitespace, 22, 24],
                    [TokenType.CloseParenthesis, 24, 25],
                ],
            },
        ]))("should tokenize '$actual' as $as", testTokenization);
    });

    describe('should tokenize invalid inputs as <bad-url-token>', () => {
        test.each([
            'url(a a', // space in url
            'url(a a)', // space in url
            'url(https://example.com /media/diamonds.png', // space in url
            'url(https://example.com /media/diamonds.png)', // space in url
            'url(aa"', // quote in url
            "url(aa')", // quote in url
            'url(aa()', // left parenthesis in url
            `url(${String.fromCharCode(CodePoint.Delete)}`, // non-printable character in url
            'url(aa\\\n)', // invalid escape sequence
            'url(aa\\\n\\)bb)', // bad url remnants contains a valid escape sequence
        ])("should tokenize '%s' as <bad-url-token>", (actual) => {
            const tokens: TokenData[] = [];
            tokenize(actual, (...args) => tokens.push(args));
            expect(tokens).toEqual([
                [TokenType.BadUrl, 0, actual.length],
            ]);
        });
    });
});
