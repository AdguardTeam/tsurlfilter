import { NodeExpectContext, type NodeExpectFn } from '../../../helpers/node-utils';
import { defaultLocation, type ScriptletInjectionRuleBody } from '../../../../src/parser/common';
import { AdgScriptletInjectionBodyParser } from '../../../../src/parser/cosmetic/body/adg-scriptlet';
import { AdblockSyntaxError } from '../../../../src/errors/adblock-syntax-error';
import { shiftLoc } from '../../../../src/utils/location';

describe('AdgScriptletInjectionBodyParser', () => {
    describe('AdgScriptletInjectionBodyParser.parse - valid cases', () => {
        test.each<{ actual: string; expected: NodeExpectFn<ScriptletInjectionRuleBody> }>([
            // escaped chars
            {
                actual: String.raw`//scriptlet('a\'b')`,
                expected: (context: NodeExpectContext): ScriptletInjectionRuleBody => {
                    return {
                        type: 'ScriptletInjectionRuleBody',
                        loc: context.getFullLocRange(),
                        children: [
                            {
                                type: 'ParameterList',
                                loc: context.getLocRangeFor(String.raw`'a\'b'`),
                                children: [
                                    {
                                        type: 'Parameter',
                                        loc: context.getLocRangeFor(String.raw`'a\'b'`),
                                        value: String.raw`'a\'b'`,
                                    },
                                ],
                            },
                        ],
                    };
                },
            },
            {
                actual: String.raw`//scriptlet("a\"b")`,
                expected: (context: NodeExpectContext): ScriptletInjectionRuleBody => {
                    return {
                        type: 'ScriptletInjectionRuleBody',
                        loc: context.getFullLocRange(),
                        children: [
                            {
                                type: 'ParameterList',
                                loc: context.getLocRangeFor(String.raw`"a\"b"`),
                                children: [
                                    {
                                        type: 'Parameter',
                                        loc: context.getLocRangeFor(String.raw`"a\"b"`),
                                        value: String.raw`"a\"b"`,
                                    },
                                ],
                            },
                        ],
                    };
                },
            },

            // different string quote in the string
            {
                actual: String.raw`//scriptlet('a"b')`,
                expected: (context: NodeExpectContext): ScriptletInjectionRuleBody => {
                    return {
                        type: 'ScriptletInjectionRuleBody',
                        loc: context.getFullLocRange(),
                        children: [
                            {
                                type: 'ParameterList',
                                loc: context.getLocRangeFor(String.raw`'a"b'`),
                                children: [
                                    {
                                        type: 'Parameter',
                                        loc: context.getLocRangeFor(String.raw`'a"b'`),
                                        value: String.raw`'a"b'`,
                                    },
                                ],
                            },
                        ],
                    };
                },
            },
            {
                actual: String.raw`//scriptlet("a'b")`,
                expected: (context: NodeExpectContext): ScriptletInjectionRuleBody => {
                    return {
                        type: 'ScriptletInjectionRuleBody',
                        loc: context.getFullLocRange(),
                        children: [
                            {
                                type: 'ParameterList',
                                loc: context.getLocRangeFor(String.raw`"a'b"`),
                                children: [
                                    {
                                        type: 'Parameter',
                                        loc: context.getLocRangeFor(String.raw`"a'b"`),
                                        value: String.raw`"a'b"`,
                                    },
                                ],
                            },
                        ],
                    };
                },
            },

            // regular cases
            {
                actual: String.raw`//scriptlet('scriptlet0')`,
                expected: (context: NodeExpectContext): ScriptletInjectionRuleBody => {
                    return {
                        type: 'ScriptletInjectionRuleBody',
                        loc: context.getFullLocRange(),
                        children: [
                            {
                                type: 'ParameterList',
                                loc: context.getLocRangeFor(String.raw`'scriptlet0'`),
                                children: [
                                    {
                                        type: 'Parameter',
                                        loc: context.getLocRangeFor(String.raw`'scriptlet0'`),
                                        value: String.raw`'scriptlet0'`,
                                    },
                                ],
                            },
                        ],
                    };
                },
            },
            // extra space
            {
                actual: String.raw`//scriptlet( 'scriptlet0' )`,
                expected: (context: NodeExpectContext): ScriptletInjectionRuleBody => {
                    return {
                        type: 'ScriptletInjectionRuleBody',
                        loc: context.getFullLocRange(),
                        children: [
                            {
                                type: 'ParameterList',
                                loc: context.getLocRangeFor(String.raw` 'scriptlet0' `),
                                children: [
                                    {
                                        type: 'Parameter',
                                        loc: context.getLocRangeFor(String.raw`'scriptlet0'`),
                                        value: String.raw`'scriptlet0'`,
                                    },
                                ],
                            },
                        ],
                    };
                },
            },
            {
                actual: String.raw`//scriptlet("scriptlet0")`,
                expected: (context: NodeExpectContext): ScriptletInjectionRuleBody => {
                    return {
                        type: 'ScriptletInjectionRuleBody',
                        loc: context.getFullLocRange(),
                        children: [
                            {
                                type: 'ParameterList',
                                loc: context.getLocRangeFor(String.raw`"scriptlet0"`),
                                children: [
                                    {
                                        type: 'Parameter',
                                        loc: context.getLocRangeFor(String.raw`"scriptlet0"`),
                                        value: String.raw`"scriptlet0"`,
                                    },
                                ],
                            },
                        ],
                    };
                },
            },
            {
                actual: String.raw`//scriptlet('scriptlet0', 'arg0', 'arg1')`,
                expected: (context: NodeExpectContext): ScriptletInjectionRuleBody => {
                    return {
                        type: 'ScriptletInjectionRuleBody',
                        loc: context.getFullLocRange(),
                        children: [
                            {
                                type: 'ParameterList',
                                loc: context.getLocRangeFor(String.raw`'scriptlet0', 'arg0', 'arg1'`),
                                children: [
                                    {
                                        type: 'Parameter',
                                        loc: context.getLocRangeFor(String.raw`'scriptlet0'`),
                                        value: "'scriptlet0'",
                                    },
                                    {
                                        type: 'Parameter',
                                        loc: context.getLocRangeFor(String.raw`'arg0'`),
                                        value: "'arg0'",
                                    },
                                    {
                                        type: 'Parameter',
                                        loc: context.getLocRangeFor(String.raw`'arg1'`),
                                        value: "'arg1'",
                                    },
                                ],
                            },
                        ],
                    };
                },
            },
            {
                actual: String.raw`//scriptlet("scriptlet0", "arg0", "arg1")`,
                expected: (context: NodeExpectContext): ScriptletInjectionRuleBody => {
                    return {
                        type: 'ScriptletInjectionRuleBody',
                        loc: context.getFullLocRange(),
                        children: [
                            {
                                type: 'ParameterList',
                                loc: context.getLocRangeFor(String.raw`"scriptlet0", "arg0", "arg1"`),
                                children: [
                                    {
                                        type: 'Parameter',
                                        loc: context.getLocRangeFor(String.raw`"scriptlet0"`),
                                        value: '"scriptlet0"',
                                    },
                                    {
                                        type: 'Parameter',
                                        loc: context.getLocRangeFor(String.raw`"arg0"`),
                                        value: '"arg0"',
                                    },
                                    {
                                        type: 'Parameter',
                                        loc: context.getLocRangeFor(String.raw`"arg1"`),
                                        value: '"arg1"',
                                    },
                                ],
                            },
                        ],
                    };
                },
            },
        ])("should parse '$actual'", ({ actual, expected: expectedFn }) => {
            // eslint-disable-next-line max-len
            expect(AdgScriptletInjectionBodyParser.parse(actual)).toMatchObject(expectedFn(new NodeExpectContext(actual)));
        });
    });

    describe('AdgScriptletInjectionBodyParser.parse - invalid cases', () => {
        test.each<{ actual: string; expected: NodeExpectFn<AdblockSyntaxError> }>([
            {
                actual: String.raw`aaa`,
                //                 ~~~
                expected: (context: NodeExpectContext): AdblockSyntaxError => {
                    return new AdblockSyntaxError(
                        AdgScriptletInjectionBodyParser.ERROR_MESSAGES.NO_SCRIPTLET_MASK,
                        context.getFullLocRange(),
                    );
                },
            },

            {
                actual: String.raw`//scriptlet`,
                //                            ~
                expected: (context: NodeExpectContext): AdblockSyntaxError => {
                    return new AdblockSyntaxError(
                        AdgScriptletInjectionBodyParser.ERROR_MESSAGES.NO_OPENING_PARENTHESIS,
                        {
                            start: shiftLoc(defaultLocation, context.actual.length),
                            end: shiftLoc(defaultLocation, context.actual.length),
                        },
                    );
                },
            },
            {
                actual: String.raw`//scriptletarg0`,
                //                            ~~~~
                expected: (context: NodeExpectContext): AdblockSyntaxError => {
                    return new AdblockSyntaxError(
                        AdgScriptletInjectionBodyParser.ERROR_MESSAGES.NO_OPENING_PARENTHESIS,
                        context.getLocRangeFor(String.raw`arg0`),
                    );
                },
            },

            {
                actual: String.raw`//scriptlet ('scriptlet')`,
                //                            ~~~~~~~~~~~~~~
                expected: (context: NodeExpectContext): AdblockSyntaxError => {
                    return new AdblockSyntaxError(
                        AdgScriptletInjectionBodyParser.ERROR_MESSAGES.WHITESPACE_AFTER_MASK,
                        context.getLocRangeFor(String.raw` ('scriptlet')`),
                    );
                },
            },

            {
                actual: String.raw`//scriptlet('scriptlet'`,
                //                             ~~~~~~~~~~
                expected: (context: NodeExpectContext): AdblockSyntaxError => {
                    return new AdblockSyntaxError(
                        AdgScriptletInjectionBodyParser.ERROR_MESSAGES.NO_CLOSING_PARENTHESIS,
                        context.getLocRangeFor(String.raw`('scriptlet'`),
                    );
                },
            },
            {
                actual: String.raw`//scriptlet('scriptlet'\)`,
                //                            ~~~~~~~~~~~~~~
                expected: (context: NodeExpectContext): AdblockSyntaxError => {
                    return new AdblockSyntaxError(
                        AdgScriptletInjectionBodyParser.ERROR_MESSAGES.NO_CLOSING_PARENTHESIS,
                        context.getLocRangeFor(String.raw`('scriptlet'\)`),
                    );
                },
            },

            {
                actual: String.raw`//scriptlet(, 'arg0')`,
                //                            ~~~~~~~~~~
                expected: (context: NodeExpectContext): AdblockSyntaxError => {
                    return new AdblockSyntaxError(
                        AdgScriptletInjectionBodyParser.ERROR_MESSAGES.NO_SCRIPTLET_NAME,
                        context.getLocRangeFor(String.raw`(, 'arg0')`),
                    );
                },
            },
            {
                actual: String.raw`//scriptlet( , 'arg0')`,
                //                            ~~~~~~~~~~~
                expected: (context: NodeExpectContext): AdblockSyntaxError => {
                    return new AdblockSyntaxError(
                        AdgScriptletInjectionBodyParser.ERROR_MESSAGES.NO_SCRIPTLET_NAME,
                        context.getLocRangeFor(String.raw`( , 'arg0')`),
                    );
                },
            },
        ])("should throw on input: '$actual'", ({ actual, expected: expectedFn }) => {
            const fn = jest.fn(() => AdgScriptletInjectionBodyParser.parse(actual));

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

    describe('AdgScriptletInjectionBodyParser.generate', () => {
        test.each<{ actual: string; expected: string }>([
            {
                actual: String.raw`//scriptlet('a\'b')`,
                expected: String.raw`//scriptlet('a\'b')`,
            },
            {
                actual: String.raw`//scriptlet("a\"b")`,
                expected: String.raw`//scriptlet("a\"b")`,
            },

            {
                actual: String.raw`//scriptlet('a"b')`,
                expected: String.raw`//scriptlet('a"b')`,
            },
            {
                actual: String.raw`//scriptlet("a'b")`,
                expected: String.raw`//scriptlet("a'b")`,
            },

            {
                actual: String.raw`//scriptlet('scriptlet0')`,
                expected: String.raw`//scriptlet('scriptlet0')`,
            },
            {
                actual: String.raw`//scriptlet("scriptlet0")`,
                expected: String.raw`//scriptlet("scriptlet0")`,
            },
            {
                actual: String.raw`//scriptlet('scriptlet0', 'arg0', 'arg1')`,
                expected: String.raw`//scriptlet('scriptlet0', 'arg0', 'arg1')`,
            },
            {
                actual: String.raw`//scriptlet("scriptlet0", "arg0", "arg1")`,
                expected: String.raw`//scriptlet("scriptlet0", "arg0", "arg1")`,
            },
        ])("should generate '$expected' from '$actual'", ({ actual, expected }) => {
            const ruleNode = AdgScriptletInjectionBodyParser.parse(actual);

            if (ruleNode === null) {
                throw new Error(`Failed to parse '${actual}' as cosmetic rule`);
            }

            expect(AdgScriptletInjectionBodyParser.generate(ruleNode)).toBe(expected);
        });
    });
});
