import { sprintf } from 'sprintf-js';
import { TokenType, getFormattedTokenName } from '@adguard/css-tokenizer';

import { AdblockSyntaxError } from '../../../src/errors/adblock-syntax-error';
import {
    AdgCssInjectionParser,
    ERROR_MESSAGES as ADG_CSS_INJ_ERROR_MESSAGES,
    REMOVE_VALUE,
} from '../../../src/parser/css/adg-css-injection';
import { ERROR_MESSAGES as CSS_TOKEN_STREAM_ERROR_MESSAGES, END_OF_INPUT } from '../../../src/parser/css/constants';
import { NodeExpectContext, type NodeExpectFn } from '../../helpers/node-utils';
import { type CssInjectionRuleBody } from '../../../src/parser/common';

describe('AdgCssInjectionParser', () => {
    describe('AdgCssInjectionParser.parse - valid', () => {
        test.each<{ actual: string; expected: NodeExpectFn<CssInjectionRuleBody> }>([
            {
                actual: 'div { padding: 0; }',
                expected: (context: NodeExpectContext): CssInjectionRuleBody => {
                    return {
                        type: 'CssInjectionRuleBody',
                        loc: context.getFullLocRange(),
                        selectorList: {
                            type: 'Value',
                            value: 'div',
                            loc: context.getLocRangeFor('div'),
                        },
                        declarationList: {
                            type: 'Value',
                            value: 'padding: 0;',
                            loc: context.getLocRangeFor('padding: 0;'),
                        },
                    };
                },
            },
            {
                actual: 'div:has(> section[advert]) { padding-top: 0 !important; padding-bottom: 0 !important; }',
                expected: (context: NodeExpectContext): CssInjectionRuleBody => {
                    return {
                        type: 'CssInjectionRuleBody',
                        loc: context.getFullLocRange(),
                        selectorList: {
                            type: 'Value',
                            value: 'div:has(> section[advert])',
                            loc: context.getLocRangeFor('div:has(> section[advert])'),
                        },
                        declarationList: {
                            type: 'Value',
                            value: 'padding-top: 0 !important; padding-bottom: 0 !important;',
                            loc: context.getLocRangeFor('padding-top: 0 !important; padding-bottom: 0 !important;'),
                        },
                    };
                },
            },
            // complicated case
            {
                // eslint-disable-next-line max-len
                actual: '@media ((min-width: 400px) and (max-width: 700px)) { div:has(> section[advert]) { padding-top: 0 !important; padding-bottom: 0 !important; } }',
                expected: (context: NodeExpectContext): CssInjectionRuleBody => {
                    return {
                        type: 'CssInjectionRuleBody',
                        loc: context.getFullLocRange(),
                        mediaQueryList: {
                            type: 'Value',
                            value: '((min-width: 400px) and (max-width: 700px))',
                            loc: context.getLocRangeFor('((min-width: 400px) and (max-width: 700px))'),
                        },
                        selectorList: {
                            type: 'Value',
                            value: 'div:has(> section[advert])',
                            loc: context.getLocRangeFor('div:has(> section[advert])'),
                        },
                        declarationList: {
                            type: 'Value',
                            value: 'padding-top: 0 !important; padding-bottom: 0 !important;',
                            loc: context.getLocRangeFor('padding-top: 0 !important; padding-bottom: 0 !important;'),
                        },
                    };
                },
            },
            {
                // eslint-disable-next-line max-len
                actual: '@media (min-width: 400px) and (max-width: 700px) { div:has(> section[advert]) { padding-top: 0 !important; padding-bottom: 0 !important; } }',
                expected: (context: NodeExpectContext): CssInjectionRuleBody => {
                    return {
                        type: 'CssInjectionRuleBody',
                        loc: context.getFullLocRange(),
                        mediaQueryList: {
                            type: 'Value',
                            value: '(min-width: 400px) and (max-width: 700px)',
                            loc: context.getLocRangeFor('(min-width: 400px) and (max-width: 700px)'),
                        },
                        selectorList: {
                            type: 'Value',
                            value: 'div:has(> section[advert])',
                            loc: context.getLocRangeFor('div:has(> section[advert])'),
                        },
                        declarationList: {
                            type: 'Value',
                            value: 'padding-top: 0 !important; padding-bottom: 0 !important;',
                            loc: context.getLocRangeFor('padding-top: 0 !important; padding-bottom: 0 !important;'),
                        },
                    };
                },
            },
            // https://developer.mozilla.org/en-US/docs/Web/CSS/@media
            {
                // eslint-disable-next-line max-len
                actual: "@media not all and (hover: hover) { abbr::after { content: 'dummy'; } }",
                expected: (context: NodeExpectContext): CssInjectionRuleBody => {
                    return {
                        type: 'CssInjectionRuleBody',
                        loc: context.getFullLocRange(),
                        mediaQueryList: {
                            type: 'Value',
                            value: 'not all and (hover: hover)',
                            loc: context.getLocRangeFor('not all and (hover: hover)'),
                        },
                        selectorList: {
                            type: 'Value',
                            value: 'abbr::after',
                            loc: context.getLocRangeFor('abbr::after'),
                        },
                        declarationList: {
                            type: 'Value',
                            value: "content: 'dummy';",
                            loc: context.getLocRangeFor("content: 'dummy';"),
                        },
                    };
                },
            },
            // remove
            {
                actual: 'div { remove: true; }',
                expected: (context: NodeExpectContext): CssInjectionRuleBody => {
                    return {
                        type: 'CssInjectionRuleBody',
                        loc: context.getFullLocRange(),
                        selectorList: {
                            type: 'Value',
                            value: 'div',
                            loc: context.getLocRangeFor('div'),
                        },
                        declarationList: {
                            type: 'Value',
                            value: 'remove: true;',
                            loc: context.getLocRangeFor('remove: true;'),
                        },
                        remove: true,
                    };
                },
            },
        ])("should parse input: '$actual'", ({ actual, expected }) => {
            expect(AdgCssInjectionParser.parse(actual)).toMatchObject(expected(new NodeExpectContext(actual)));
        });
    });

    describe('parser options should work as expected', () => {
        test.each<{ actual: string; expected: CssInjectionRuleBody }>([
            {
                actual: 'div { padding: 0; }',
                expected: {
                    type: 'CssInjectionRuleBody',
                    selectorList: {
                        type: 'Value',
                        value: 'div',
                    },
                    declarationList: {
                        type: 'Value',
                        value: 'padding: 0;',
                    },
                    remove: false,
                },
            },
        ])('isLocIncluded should work for $actual', ({ actual, expected }) => {
            expect(AdgCssInjectionParser.parse(actual, { isLocIncluded: false })).toEqual(expected);
        });
    });

    describe('AdgCssInjectionParser.parse - invalid', () => {
        test.each<{ actual: string; expected: NodeExpectFn<AdblockSyntaxError> }>([
            // media query / selector / declaration list is empty
            {
                actual: '{ padding: 0; }',
                //       ~~~~~~~~~~~~~~~
                expected: (context: NodeExpectContext): AdblockSyntaxError => {
                    return new AdblockSyntaxError(
                        ADG_CSS_INJ_ERROR_MESSAGES.SELECTOR_LIST_IS_EMPTY,
                        context.getFullLocRange(),
                    );
                },
            },
            {
                actual: ' { padding: 0; }',
                //        ~~~~~~~~~~~~~~~
                expected: (context: NodeExpectContext): AdblockSyntaxError => {
                    return new AdblockSyntaxError(
                        ADG_CSS_INJ_ERROR_MESSAGES.SELECTOR_LIST_IS_EMPTY,
                        context.getLocRangeFor('{ padding: 0; }'),
                    );
                },
            },
            {
                actual: '  { padding: 0; }',
                //         ~~~~~~~~~~~~~~~
                expected: (context: NodeExpectContext): AdblockSyntaxError => {
                    return new AdblockSyntaxError(
                        ADG_CSS_INJ_ERROR_MESSAGES.SELECTOR_LIST_IS_EMPTY,
                        context.getLocRangeFor('{ padding: 0; }'),
                    );
                },
            },
            {
                actual: '* {}',
                //          ~
                expected: (context: NodeExpectContext): AdblockSyntaxError => {
                    return new AdblockSyntaxError(
                        ADG_CSS_INJ_ERROR_MESSAGES.DECLARATION_LIST_IS_EMPTY,
                        context.getLocRangeFor('}'),
                    );
                },
            },
            {
                actual: '* { }',
                //           ~
                expected: (context: NodeExpectContext): AdblockSyntaxError => {
                    return new AdblockSyntaxError(
                        ADG_CSS_INJ_ERROR_MESSAGES.DECLARATION_LIST_IS_EMPTY,
                        context.getLocRangeFor('}'),
                    );
                },
            },
            {
                actual: '* {  }',
                //            ~
                expected: (context: NodeExpectContext): AdblockSyntaxError => {
                    return new AdblockSyntaxError(
                        ADG_CSS_INJ_ERROR_MESSAGES.DECLARATION_LIST_IS_EMPTY,
                        context.getLocRangeFor('}'),
                    );
                },
            },

            // media should be followed by (, optionally preceded by whitespace
            {
                actual: '@media',
                //            ~
                expected: (context: NodeExpectContext): AdblockSyntaxError => {
                    return new AdblockSyntaxError(
                        sprintf(
                            CSS_TOKEN_STREAM_ERROR_MESSAGES.EXPECTED_ANY_TOKEN_BUT_GOT,
                            END_OF_INPUT,
                        ),
                        context.getLocRangeFor('a'),
                    );
                },
            },
            {
                actual: '@media ',
                //             ~
                expected: (context: NodeExpectContext): AdblockSyntaxError => {
                    return new AdblockSyntaxError(
                        sprintf(
                            CSS_TOKEN_STREAM_ERROR_MESSAGES.EXPECTED_ANY_TOKEN_BUT_GOT,
                            END_OF_INPUT,
                        ),
                        context.getLocRangeFor(' '),
                    );
                },
            },
            {
                actual: '@media ident',
                //                  ~
                expected: (context: NodeExpectContext): AdblockSyntaxError => {
                    return new AdblockSyntaxError(
                        sprintf(
                            CSS_TOKEN_STREAM_ERROR_MESSAGES.EXPECTED_TOKEN_BUT_GOT,
                            getFormattedTokenName(TokenType.OpenCurlyBracket),
                            END_OF_INPUT,
                        ),
                        context.getLocRangeFor('t'),
                    );
                },
            },
            {
                actual: '@media ident ()',
                //                     ~
                expected: (context: NodeExpectContext): AdblockSyntaxError => {
                    return new AdblockSyntaxError(
                        sprintf(
                            CSS_TOKEN_STREAM_ERROR_MESSAGES.EXPECTED_TOKEN_BUT_GOT,
                            getFormattedTokenName(TokenType.OpenCurlyBracket),
                            END_OF_INPUT,
                        ),
                        context.getLocRangeFor(')'),
                    );
                },
            },

            // expected { before declaration list
            {
                actual: 'div',
                //         ~
                expected: (context: NodeExpectContext): AdblockSyntaxError => {
                    return new AdblockSyntaxError(
                        sprintf(
                            CSS_TOKEN_STREAM_ERROR_MESSAGES.EXPECTED_TOKEN_BUT_GOT,
                            getFormattedTokenName(TokenType.OpenCurlyBracket),
                            END_OF_INPUT,
                        ),
                        context.getLocRangeFor('v'),
                    );
                },
            },
            {
                actual: 'div { padding: 1;',
                //                       ~
                expected: (context: NodeExpectContext): AdblockSyntaxError => {
                    return new AdblockSyntaxError(
                        sprintf(
                            CSS_TOKEN_STREAM_ERROR_MESSAGES.EXPECTED_TOKEN_BUT_GOT,
                            getFormattedTokenName(TokenType.CloseCurlyBracket),
                            END_OF_INPUT,
                        ),
                        context.getLocRangeFor(';'),
                    );
                },
            },
            {
                actual: 'div { remove: aa; }',
                //                     ~~
                expected: (context: NodeExpectContext): AdblockSyntaxError => {
                    return new AdblockSyntaxError(
                        sprintf(
                            CSS_TOKEN_STREAM_ERROR_MESSAGES.EXPECTED_TOKEN_WITH_VALUE_BUT_GOT,
                            getFormattedTokenName(TokenType.Ident),
                            REMOVE_VALUE,
                            'aa',
                        ),
                        context.getLocRangeFor('aa'),
                    );
                },
            },
        ])("should throw on input: '$actual'", ({ actual, expected: expectedFn }) => {
            const fn = jest.fn(() => AdgCssInjectionParser.parse(actual));

            // parse should throw
            expect(fn).toThrow();

            const expected = expectedFn(new NodeExpectContext(actual));

            // check the thrown error
            const error = fn.mock.results[0].value;
            expect(error).toBeInstanceOf(AdblockSyntaxError);
            expect(error).toHaveProperty('message', expected.message);
            expect(error).toHaveProperty('loc', expected.loc);
        });
    });

    describe('AdgCssInjectionParser.generate', () => {
        test.each<{ actual: string; expected: string }>([
            {
                actual: 'div { padding: 0; }',
                expected: 'div { padding: 0; }',
            },
            // Extra whitespace
            {
                actual: '    div   {     padding: 0;      }     ',
                expected: 'div { padding: 0; }',
            },
            {
                // eslint-disable-next-line max-len
                actual: '@media ((min-width: 400px) and (max-width: 700px)) { div:has(> section[advert]) { padding-top: 0 !important; padding-bottom: 0 !important; } }',
                // eslint-disable-next-line max-len
                expected: '@media ((min-width: 400px) and (max-width: 700px)) { div:has(> section[advert]) { padding-top: 0 !important; padding-bottom: 0 !important; } }',
            },
        ])('should generate input: \'$actual\'', ({ actual, expected }) => {
            expect(AdgCssInjectionParser.generate(AdgCssInjectionParser.parse(actual))).toBe(expected);
        });
    });
});
