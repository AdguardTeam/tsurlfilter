import {
    describe,
    test,
    expect,
    vi,
} from 'vitest';
import { sprintf } from 'sprintf-js';

import { NodeExpectContext, type NodeExpectFn } from '../../../helpers/node-utils.js';
import { type ScriptletInjectionRuleBody } from '../../../../src/nodes/index.js';
import {
    AdgScriptletInjectionBodyParser,
} from '../../../../src/parser/cosmetic/body/adg-scriptlet-injection-body-parser.js';
import { AdblockSyntaxError } from '../../../../src/errors/adblock-syntax-error.js';
import {
    AdgScriptletInjectionBodyGenerator,
} from '../../../../src/generator/cosmetic/body/adg-scriptlet-injection-body-generator.js';
import {
    AdgScriptletInjectionBodySerializer,
} from '../../../../src/serializer/cosmetic/body/adg-scriptlet-injection-body-serializer.js';
import {
    AdgScriptletInjectionBodyDeserializer,
} from '../../../../src/deserializer/cosmetic/scriptlet-body/adg-scriptlet-injection-body-deserializer.js';

describe('AdgScriptletInjectionBodyParser', () => {
    describe('AdgScriptletInjectionBodyParser.parse - valid cases', () => {
        test.each<{ actual: string; expected: NodeExpectFn<ScriptletInjectionRuleBody> }>([
            // escaped chars
            {
                actual: String.raw`//scriptlet('a\'b')`,
                expected: (context: NodeExpectContext): ScriptletInjectionRuleBody => {
                    return {
                        type: 'ScriptletInjectionRuleBody',
                        ...context.getFullRange(),
                        children: [
                            {
                                type: 'ParameterList',
                                ...context.getRangeFor(String.raw`'a\'b'`),
                                children: [
                                    {
                                        type: 'Value',
                                        ...context.getRangeFor(String.raw`'a\'b'`),
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
                        ...context.getFullRange(),
                        children: [
                            {
                                type: 'ParameterList',
                                ...context.getRangeFor(String.raw`"a\"b"`),
                                children: [
                                    {
                                        type: 'Value',
                                        ...context.getRangeFor(String.raw`"a\"b"`),
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
                        ...context.getFullRange(),
                        children: [
                            {
                                type: 'ParameterList',
                                ...context.getRangeFor(String.raw`'a"b'`),
                                children: [
                                    {
                                        type: 'Value',
                                        ...context.getRangeFor(String.raw`'a"b'`),
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
                        ...context.getFullRange(),
                        children: [
                            {
                                type: 'ParameterList',
                                ...context.getRangeFor(String.raw`"a'b"`),
                                children: [
                                    {
                                        type: 'Value',
                                        ...context.getRangeFor(String.raw`"a'b"`),
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
                        ...context.getFullRange(),
                        children: [
                            {
                                type: 'ParameterList',
                                ...context.getRangeFor(String.raw`'scriptlet0'`),
                                children: [
                                    {
                                        type: 'Value',
                                        ...context.getRangeFor(String.raw`'scriptlet0'`),
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
                        ...context.getFullRange(),
                        children: [
                            {
                                type: 'ParameterList',
                                ...context.getRangeFor(String.raw` 'scriptlet0' `),
                                children: [
                                    {
                                        type: 'Value',
                                        ...context.getRangeFor(String.raw`'scriptlet0'`),
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
                        ...context.getFullRange(),
                        children: [
                            {
                                type: 'ParameterList',
                                ...context.getRangeFor(String.raw`"scriptlet0"`),
                                children: [
                                    {
                                        type: 'Value',
                                        ...context.getRangeFor(String.raw`"scriptlet0"`),
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
                        ...context.getFullRange(),
                        children: [
                            {
                                type: 'ParameterList',
                                ...context.getRangeFor(String.raw`'scriptlet0', 'arg0', 'arg1'`),
                                children: [
                                    {
                                        type: 'Value',
                                        ...context.getRangeFor(String.raw`'scriptlet0'`),
                                        value: "'scriptlet0'",
                                    },
                                    {
                                        type: 'Value',
                                        ...context.getRangeFor(String.raw`'arg0'`),
                                        value: "'arg0'",
                                    },
                                    {
                                        type: 'Value',
                                        ...context.getRangeFor(String.raw`'arg1'`),
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
                        ...context.getFullRange(),
                        children: [
                            {
                                type: 'ParameterList',
                                ...context.getRangeFor(String.raw`"scriptlet0", "arg0", "arg1"`),
                                children: [
                                    {
                                        type: 'Value',
                                        ...context.getRangeFor(String.raw`"scriptlet0"`),
                                        value: '"scriptlet0"',
                                    },
                                    {
                                        type: 'Value',
                                        ...context.getRangeFor(String.raw`"arg0"`),
                                        value: '"arg0"',
                                    },
                                    {
                                        type: 'Value',
                                        ...context.getRangeFor(String.raw`"arg1"`),
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
                        ...context.toTuple(context.getFullRange()),
                    );
                },
            },

            {
                actual: String.raw`//scriptlet`,
                //                            ~
                expected: (context: NodeExpectContext): AdblockSyntaxError => {
                    return new AdblockSyntaxError(
                        AdgScriptletInjectionBodyParser.ERROR_MESSAGES.NO_OPENING_PARENTHESIS,
                        context.actual.length,
                        context.actual.length,
                    );
                },
            },
            {
                actual: String.raw`//scriptletarg0`,
                //                            ~~~~
                expected: (context: NodeExpectContext): AdblockSyntaxError => {
                    return new AdblockSyntaxError(
                        AdgScriptletInjectionBodyParser.ERROR_MESSAGES.NO_OPENING_PARENTHESIS,
                        ...context.toTuple(context.getRangeFor(String.raw`arg0`)),
                    );
                },
            },

            {
                actual: String.raw`//scriptlet ('scriptlet')`,
                //                            ~~~~~~~~~~~~~~
                expected: (context: NodeExpectContext): AdblockSyntaxError => {
                    return new AdblockSyntaxError(
                        AdgScriptletInjectionBodyParser.ERROR_MESSAGES.WHITESPACE_AFTER_MASK,
                        ...context.toTuple(context.getRangeFor(String.raw` ('scriptlet')`)),
                    );
                },
            },

            {
                actual: String.raw`//scriptlet('scriptlet'`,
                //                             ~~~~~~~~~~
                expected: (context: NodeExpectContext): AdblockSyntaxError => {
                    return new AdblockSyntaxError(
                        AdgScriptletInjectionBodyParser.ERROR_MESSAGES.NO_CLOSING_PARENTHESIS,
                        ...context.toTuple(context.getRangeFor(String.raw`('scriptlet'`)),
                    );
                },
            },
            {
                actual: String.raw`//scriptlet('scriptlet'\)`,
                //                            ~~~~~~~~~~~~~~
                expected: (context: NodeExpectContext): AdblockSyntaxError => {
                    return new AdblockSyntaxError(
                        AdgScriptletInjectionBodyParser.ERROR_MESSAGES.NO_CLOSING_PARENTHESIS,
                        ...context.toTuple(context.getRangeFor(String.raw`('scriptlet'\)`)),
                    );
                },
            },

            {
                actual: String.raw`//scriptlet(, 'arg0')`,
                //                            ~~~~~~~~~~
                expected: (context: NodeExpectContext): AdblockSyntaxError => {
                    return new AdblockSyntaxError(
                        sprintf(AdgScriptletInjectionBodyParser.ERROR_MESSAGES.EXPECTED_QUOTE, ','),
                        ...context.toTuple(context.getRangeFor(String.raw`, 'arg0')`)),
                    );
                },
            },
            {
                actual: String.raw`//scriptlet( , 'arg0')`,
                //                            ~~~~~~~~~~~
                expected: (context: NodeExpectContext): AdblockSyntaxError => {
                    return new AdblockSyntaxError(
                        sprintf(AdgScriptletInjectionBodyParser.ERROR_MESSAGES.EXPECTED_QUOTE, ','),
                        ...context.toTuple(context.getRangeFor(String.raw`, 'arg0')`)),
                    );
                },
            },
            {
                actual: String.raw`//scriptlet('foo', "bar")`,
                //                                    ~~~~~~
                expected: (context: NodeExpectContext): AdblockSyntaxError => {
                    return new AdblockSyntaxError(
                        AdgScriptletInjectionBodyParser.ERROR_MESSAGES.NO_INCONSISTENT_QUOTES,
                        ...context.toTuple(context.getRangeFor(String.raw`"bar")`)),
                    );
                },
            },
            {
                actual: String.raw`//scriptlet('foo', "bar", 'baz')`,
                //                                    ~~~~~~~~~~~~~
                expected: (context: NodeExpectContext): AdblockSyntaxError => {
                    return new AdblockSyntaxError(
                        AdgScriptletInjectionBodyParser.ERROR_MESSAGES.NO_INCONSISTENT_QUOTES,
                        ...context.toTuple(context.getRangeFor(String.raw`"bar", 'baz')`)),
                    );
                },
            },
            {
                actual: String.raw`//scriptlet('foo', 'bar', "baz")`,
                //                                           ~~~~~~
                expected: (context: NodeExpectContext): AdblockSyntaxError => {
                    return new AdblockSyntaxError(
                        AdgScriptletInjectionBodyParser.ERROR_MESSAGES.NO_INCONSISTENT_QUOTES,
                        ...context.toTuple(context.getRangeFor(String.raw`"baz")`)),
                    );
                },
            },

            {
                actual: String.raw`//scriptlet('foo' 'bar')`,
                //                                   ~~~~~~
                expected: (context: NodeExpectContext): AdblockSyntaxError => {
                    return new AdblockSyntaxError(
                        sprintf(AdgScriptletInjectionBodyParser.ERROR_MESSAGES.EXPECTED_COMMA, "'"),
                        ...context.toTuple(context.getRangeFor(String.raw`'bar')`)),
                    );
                },
            },
            {
                actual: String.raw`//scriptlet('foo', 'bar''baz')`,
                //                                         ~~~~~~
                expected: (context: NodeExpectContext): AdblockSyntaxError => {
                    return new AdblockSyntaxError(
                        sprintf(AdgScriptletInjectionBodyParser.ERROR_MESSAGES.EXPECTED_COMMA, "'"),
                        ...context.toTuple(context.getRangeFor(String.raw`'baz')`)),
                    );
                },
            },
            {
                actual: String.raw`//scriptlet(foo)`,
                //                             ~~~~
                expected: (context: NodeExpectContext): AdblockSyntaxError => {
                    return new AdblockSyntaxError(
                        sprintf(AdgScriptletInjectionBodyParser.ERROR_MESSAGES.EXPECTED_QUOTE, 'f'),
                        ...context.toTuple(context.getRangeFor(String.raw`foo)`)),
                    );
                },
            },
            {
                actual: String.raw`//scriptlet('foo', bar, 'baz')`,
                //                                    ~~~~~~~~~~~
                expected: (context: NodeExpectContext): AdblockSyntaxError => {
                    return new AdblockSyntaxError(
                        sprintf(AdgScriptletInjectionBodyParser.ERROR_MESSAGES.EXPECTED_QUOTE, 'b'),
                        ...context.toTuple(context.getRangeFor(String.raw`bar, 'baz')`)),
                    );
                },
            },
            {
                actual: String.raw`//scriptlet('foo)`,
                //                             ~~~~~
                expected: (context: NodeExpectContext): AdblockSyntaxError => {
                    return new AdblockSyntaxError(
                        AdgScriptletInjectionBodyParser.ERROR_MESSAGES.NO_UNCLOSED_PARAMETER,
                        ...context.toTuple(context.getRangeFor(String.raw`'foo)`)),
                    );
                },
            },
            {
                actual: String.raw`//scriptlet('foo', 'bar   )`,
                //                                    ~~~~~~~~
                expected: (context: NodeExpectContext): AdblockSyntaxError => {
                    return new AdblockSyntaxError(
                        AdgScriptletInjectionBodyParser.ERROR_MESSAGES.NO_UNCLOSED_PARAMETER,
                        ...context.toTuple(context.getRangeFor(String.raw`'bar   )`)),
                    );
                },
            },
        ])("should throw on input: '$actual'", ({ actual, expected: expectedFn }) => {
            const fn = vi.fn(() => AdgScriptletInjectionBodyParser.parse(actual));

            // parse should throw
            expect(fn).toThrow();

            const expected = expectedFn(new NodeExpectContext(actual));

            // check the thrown error
            const error = fn.mock.results[0].value;
            expect(error).toBeInstanceOf(AdblockSyntaxError);
            expect(error).toHaveProperty('message', expected.message);
            expect(error).toHaveProperty('start', expected.start);
            expect(error).toHaveProperty('end', expected.end);
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

            expect(AdgScriptletInjectionBodyGenerator.generate(ruleNode)).toBe(expected);
        });
    });

    describe('serialize & deserialize', () => {
        test.each([
            '//scriptlet()',
            '//scriptlet("scriptlet0")',
            '//scriptlet("scriptlet0", "arg0", "arg1")',
        ])("should serialize and deserialize '%p'", async (input) => {
            await expect(input).toBeSerializedAndDeserializedProperly(
                AdgScriptletInjectionBodyParser,
                AdgScriptletInjectionBodyGenerator,
                AdgScriptletInjectionBodySerializer,
                AdgScriptletInjectionBodyDeserializer,
            );
        });
    });
});
