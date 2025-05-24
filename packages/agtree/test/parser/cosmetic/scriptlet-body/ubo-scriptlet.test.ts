import {
    describe,
    test,
    expect,
    vi,
} from 'vitest';

import { NodeExpectContext, type NodeExpectFn } from '../../../helpers/node-utils.js';
import { type ScriptletInjectionRuleBody } from '../../../../src/nodes/index.js';
import {
    UboScriptletInjectionBodyParser,
} from '../../../../src/parser/cosmetic/body/ubo-scriptlet-injection-body-parser.js';
import { AdblockSyntaxError } from '../../../../src/errors/adblock-syntax-error.js';
import {
    UboScriptletInjectionBodyGenerator,
} from '../../../../src/generator/cosmetic/body/ubo-scriptlet-injection-body-generator.js';
import {
    UboScriptletInjectionBodySerializer,
} from '../../../../src/serializer/cosmetic/body/ubo-scriptlet-injection-body-serializer.js';
import {
    UboScriptletInjectionBodyDeserializer,
} from '../../../../src/deserializer/cosmetic/scriptlet-body/ubo-scriptlet-injection-body-deserializer.js';

describe('UboScriptletInjectionBodyParser', () => {
    describe('UboScriptletInjectionBodyParser.parse - valid cases', () => {
        test.each<{ actual: string; expected: NodeExpectFn<ScriptletInjectionRuleBody> }>([
            // legacy syntax
            {
                actual: String.raw`script:inject(foo)`,
                expected: (context: NodeExpectContext): ScriptletInjectionRuleBody => {
                    return {
                        type: 'ScriptletInjectionRuleBody',
                        ...context.getFullRange(),
                        children: [
                            {
                                type: 'ParameterList',
                                ...context.getRangeFor(String.raw`foo`),
                                children: [
                                    {
                                        type: 'Value',
                                        ...context.getRangeFor(String.raw`foo`),
                                        value: String.raw`foo`,
                                    },
                                ],
                            },
                        ],
                    };
                },
            },
            {
                actual: String.raw`+js()`,
                expected: (context: NodeExpectContext): ScriptletInjectionRuleBody => {
                    return {
                        type: 'ScriptletInjectionRuleBody',
                        ...context.getFullRange(),
                        children: [],
                    };
                },
            },
            {
                actual: String.raw`+js( )`,
                expected: (context: NodeExpectContext): ScriptletInjectionRuleBody => {
                    return {
                        type: 'ScriptletInjectionRuleBody',
                        ...context.getFullRange(),
                        children: [],
                    };
                },
            },
            // escaped chars
            {
                actual: String.raw`+js('a\'b')`,
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
                actual: String.raw`+js("a\"b")`,
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
                actual: String.raw`+js('a"b')`,
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
                actual: String.raw`+js("a'b")`,
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
                actual: String.raw`+js('scriptlet0')`,
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
                actual: String.raw`+js( 'scriptlet0' )`,
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
                actual: String.raw`+js("scriptlet0")`,
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
                actual: String.raw`+js( scriptlet0 , arg0 )`,
                expected: (context: NodeExpectContext): ScriptletInjectionRuleBody => {
                    return {
                        type: 'ScriptletInjectionRuleBody',
                        ...context.getFullRange(),
                        children: [
                            {
                                type: 'ParameterList',
                                ...context.getRangeFor(String.raw` scriptlet0 , arg0 `),
                                children: [
                                    {
                                        type: 'Value',
                                        ...context.getRangeFor(String.raw`scriptlet0`),
                                        value: 'scriptlet0',
                                    },
                                    {
                                        type: 'Value',
                                        ...context.getRangeFor(String.raw`arg0`),
                                        value: 'arg0',
                                    },
                                ],
                            },
                        ],
                    };
                },
            },
            {
                actual: String.raw`+js(scriptlet0, arg0, arg1)`,
                expected: (context: NodeExpectContext): ScriptletInjectionRuleBody => {
                    return {
                        type: 'ScriptletInjectionRuleBody',
                        ...context.getFullRange(),
                        children: [
                            {
                                type: 'ParameterList',
                                ...context.getRangeFor(String.raw`scriptlet0, arg0, arg1`),
                                children: [
                                    {
                                        type: 'Value',
                                        ...context.getRangeFor(String.raw`scriptlet0`),
                                        value: 'scriptlet0',
                                    },
                                    {
                                        type: 'Value',
                                        ...context.getRangeFor(String.raw`arg0`),
                                        value: 'arg0',
                                    },
                                    {
                                        type: 'Value',
                                        ...context.getRangeFor(String.raw`arg1`),
                                        value: 'arg1',
                                    },
                                ],
                            },
                        ],
                    };
                },
            },
            {
                actual: String.raw`+js(scriptlet0, arg00\,arg01, arg1)`,
                expected: (context: NodeExpectContext): ScriptletInjectionRuleBody => {
                    return {
                        type: 'ScriptletInjectionRuleBody',
                        ...context.getFullRange(),
                        children: [
                            {
                                type: 'ParameterList',
                                ...context.getRangeFor(String.raw`scriptlet0, arg00\,arg01, arg1`),
                                children: [
                                    {
                                        type: 'Value',
                                        ...context.getRangeFor(String.raw`scriptlet0`),
                                        value: 'scriptlet0',
                                    },
                                    {
                                        type: 'Value',
                                        ...context.getRangeFor(String.raw`arg00\,arg01`),
                                        value: String.raw`arg00\,arg01`,
                                    },
                                    {
                                        type: 'Value',
                                        ...context.getRangeFor(String.raw`arg1`),
                                        value: 'arg1',
                                    },
                                ],
                            },
                        ],
                    };
                },
            },
            {
                actual: String.raw`+js(scriptlet0, 'arg0', "arg1", /arg2/, arg3)`,
                expected: (context: NodeExpectContext): ScriptletInjectionRuleBody => {
                    return {
                        type: 'ScriptletInjectionRuleBody',
                        ...context.getFullRange(),
                        children: [
                            {
                                type: 'ParameterList',
                                ...context.getRangeFor(String.raw`scriptlet0, 'arg0', "arg1", /arg2/, arg3`),
                                children: [
                                    {
                                        type: 'Value',
                                        ...context.getRangeFor(String.raw`scriptlet0`),
                                        value: 'scriptlet0',
                                    },
                                    {
                                        type: 'Value',
                                        ...context.getRangeFor(String.raw`'arg0'`),
                                        value: "'arg0'",
                                    },
                                    {
                                        type: 'Value',
                                        ...context.getRangeFor(String.raw`"arg1"`),
                                        value: '"arg1"',
                                    },
                                    {
                                        type: 'Value',
                                        ...context.getRangeFor(String.raw`/arg2/`),
                                        value: '/arg2/',
                                    },
                                    {
                                        type: 'Value',
                                        ...context.getRangeFor(String.raw`arg3`),
                                        value: 'arg3',
                                    },
                                ],
                            },
                        ],
                    };
                },
            },
            {
                actual: String.raw`+js(scriptlet0, 'ar\'g0', "ar\"g1", /ar\/g2/)`,
                expected: (context: NodeExpectContext): ScriptletInjectionRuleBody => {
                    return {
                        type: 'ScriptletInjectionRuleBody',
                        ...context.getFullRange(),
                        children: [
                            {
                                type: 'ParameterList',
                                ...context.getRangeFor(String.raw`scriptlet0, 'ar\'g0', "ar\"g1", /ar\/g2/`),
                                children: [
                                    {
                                        type: 'Value',
                                        ...context.getRangeFor(String.raw`scriptlet0`),
                                        value: 'scriptlet0',
                                    },
                                    {
                                        type: 'Value',
                                        ...context.getRangeFor(String.raw`'ar\'g0'`),
                                        value: String.raw`'ar\'g0'`,
                                    },
                                    {
                                        type: 'Value',
                                        ...context.getRangeFor(String.raw`"ar\"g1"`),
                                        value: String.raw`"ar\"g1"`,
                                    },
                                    {
                                        type: 'Value',
                                        ...context.getRangeFor(String.raw`/ar\/g2/`),
                                        value: String.raw`/ar\/g2/`,
                                    },
                                ],
                            },
                        ],
                    };
                },
            },
            {
                actual: String.raw`+js('scriptlet0', 'arg0', 'arg1')`,
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
                actual: String.raw`+js("scriptlet0", "arg0", "arg1")`,
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

            {
                actual: String.raw`+js(a,b)`,
                expected: (context: NodeExpectContext): ScriptletInjectionRuleBody => {
                    return {
                        type: 'ScriptletInjectionRuleBody',
                        ...context.getFullRange(),
                        children: [
                            {
                                type: 'ParameterList',
                                ...context.getRangeFor(String.raw`a,b`),
                                children: [
                                    {
                                        type: 'Value',
                                        ...context.getRangeFor(String.raw`a`),
                                        value: String.raw`a`,
                                    },
                                    {
                                        type: 'Value',
                                        ...context.getRangeFor(String.raw`b`),
                                        value: String.raw`b`,
                                    },
                                ],
                            },
                        ],
                    };
                },
            },
            {
                actual: String.raw`+js(a, b)`,
                expected: (context: NodeExpectContext): ScriptletInjectionRuleBody => {
                    return {
                        type: 'ScriptletInjectionRuleBody',
                        ...context.getFullRange(),
                        children: [
                            {
                                type: 'ParameterList',
                                ...context.getRangeFor(String.raw`a, b`),
                                children: [
                                    {
                                        type: 'Value',
                                        ...context.getRangeFor(String.raw`a`),
                                        value: String.raw`a`,
                                    },
                                    {
                                        type: 'Value',
                                        ...context.getRangeFor(String.raw`b`),
                                        value: String.raw`b`,
                                    },
                                ],
                            },
                        ],
                    };
                },
            },
            {
                actual: String.raw`+js( a , b )`,
                expected: (context: NodeExpectContext): ScriptletInjectionRuleBody => {
                    return {
                        type: 'ScriptletInjectionRuleBody',
                        ...context.getFullRange(),
                        children: [
                            {
                                type: 'ParameterList',
                                ...context.getRangeFor(String.raw` a , b `),
                                children: [
                                    {
                                        type: 'Value',
                                        ...context.getRangeFor(String.raw`a`),
                                        value: String.raw`a`,
                                    },
                                    {
                                        type: 'Value',
                                        ...context.getRangeFor(String.raw`b`),
                                        value: String.raw`b`,
                                    },
                                ],
                            },
                        ],
                    };
                },
            },

            {
                actual: String.raw`+js(a,,c)`,
                expected: (context: NodeExpectContext): ScriptletInjectionRuleBody => {
                    return {
                        type: 'ScriptletInjectionRuleBody',
                        ...context.getFullRange(),
                        children: [
                            {
                                type: 'ParameterList',
                                ...context.getRangeFor(String.raw`a,,c`),
                                children: [
                                    {
                                        type: 'Value',
                                        ...context.getRangeFor(String.raw`a`),
                                        value: String.raw`a`,
                                    },
                                    null,
                                    {
                                        type: 'Value',
                                        ...context.getRangeFor(String.raw`c`),
                                        value: String.raw`c`,
                                    },
                                ],
                            },
                        ],
                    };
                },
            },

            {
                actual: String.raw`+js(a, ,c)`,
                expected: (context: NodeExpectContext): ScriptletInjectionRuleBody => {
                    return {
                        type: 'ScriptletInjectionRuleBody',
                        ...context.getFullRange(),
                        children: [
                            {
                                type: 'ParameterList',
                                ...context.getRangeFor(String.raw`a, ,c`),
                                children: [
                                    {
                                        type: 'Value',
                                        ...context.getRangeFor(String.raw`a`),
                                        value: String.raw`a`,
                                    },
                                    null,
                                    {
                                        type: 'Value',
                                        ...context.getRangeFor(String.raw`c`),
                                        value: String.raw`c`,
                                    },
                                ],
                            },
                        ],
                    };
                },
            },
            {
                actual: String.raw`+js( a ,  , c )`,
                expected: (context: NodeExpectContext): ScriptletInjectionRuleBody => {
                    return {
                        type: 'ScriptletInjectionRuleBody',
                        ...context.getFullRange(),
                        children: [
                            {
                                type: 'ParameterList',
                                ...context.getRangeFor(String.raw` a ,  , c `),
                                children: [
                                    {
                                        type: 'Value',
                                        ...context.getRangeFor(String.raw`a`),
                                        value: String.raw`a`,
                                    },
                                    null,
                                    {
                                        type: 'Value',
                                        ...context.getRangeFor(String.raw`c`),
                                        value: String.raw`c`,
                                    },
                                ],
                            },
                        ],
                    };
                },
            },
            {
                actual: String.raw`+js(a,)`,
                expected: (context: NodeExpectContext): ScriptletInjectionRuleBody => {
                    return {
                        type: 'ScriptletInjectionRuleBody',
                        ...context.getFullRange(),
                        children: [
                            {
                                type: 'ParameterList',
                                ...context.getRangeFor(String.raw`a,`),
                                children: [
                                    {
                                        type: 'Value',
                                        ...context.getRangeFor(String.raw`a`),
                                        value: String.raw`a`,
                                    },
                                    null,
                                ],
                            },
                        ],
                    };
                },
            },
            {
                actual: String.raw`+js(a ,)`,
                expected: (context: NodeExpectContext): ScriptletInjectionRuleBody => {
                    return {
                        type: 'ScriptletInjectionRuleBody',
                        ...context.getFullRange(),
                        children: [
                            {
                                type: 'ParameterList',
                                ...context.getRangeFor(String.raw`a ,`),
                                children: [
                                    {
                                        type: 'Value',
                                        ...context.getRangeFor(String.raw`a`),
                                        value: String.raw`a`,
                                    },
                                    null,
                                ],
                            },
                        ],
                    };
                },
            },
            {
                actual: String.raw`+js(a, )`,
                expected: (context: NodeExpectContext): ScriptletInjectionRuleBody => {
                    return {
                        type: 'ScriptletInjectionRuleBody',
                        ...context.getFullRange(),
                        children: [
                            {
                                type: 'ParameterList',
                                ...context.getRangeFor(String.raw`a, `),
                                children: [
                                    {
                                        type: 'Value',
                                        ...context.getRangeFor(String.raw`a`),
                                        value: String.raw`a`,
                                    },
                                    null,
                                ],
                            },
                        ],
                    };
                },
            },
            {
                actual: String.raw`+js(a , )`,
                expected: (context: NodeExpectContext): ScriptletInjectionRuleBody => {
                    return {
                        type: 'ScriptletInjectionRuleBody',
                        ...context.getFullRange(),
                        children: [
                            {
                                type: 'ParameterList',
                                ...context.getRangeFor(String.raw`a , `),
                                children: [
                                    {
                                        type: 'Value',
                                        ...context.getRangeFor(String.raw`a`),
                                        value: String.raw`a`,
                                    },
                                    null,
                                ],
                            },
                        ],
                    };
                },
            },

            // Commas are allowed in quoted arguments
            {
                actual: String.raw`+js(trusted-set-cookie, cookies, '{"foo":1,"bar":0}')`,
                expected: (context: NodeExpectContext): ScriptletInjectionRuleBody => {
                    return {
                        type: 'ScriptletInjectionRuleBody',
                        ...context.getFullRange(),
                        children: [
                            {
                                type: 'ParameterList',
                                ...context.getRangeFor(String.raw`trusted-set-cookie, cookies, '{"foo":1,"bar":0}'`),
                                children: [
                                    {
                                        type: 'Value',
                                        ...context.getRangeFor(String.raw`trusted-set-cookie`),
                                        value: String.raw`trusted-set-cookie`,
                                    },
                                    {
                                        type: 'Value',
                                        ...context.getRangeFor(String.raw`cookies`),
                                        value: String.raw`cookies`,
                                    },
                                    {
                                        type: 'Value',
                                        ...context.getRangeFor(String.raw`'{"foo":1,"bar":0}'`),
                                        value: String.raw`'{"foo":1,"bar":0}'`,
                                    },
                                ],
                            },
                        ],
                    };
                },
            },

            // Commas should be escaped in regexps, otherwise they are treated as separators
            {
                actual: String.raw`+js(foo, /a,b/, bar)`,
                expected: (context: NodeExpectContext): ScriptletInjectionRuleBody => {
                    return {
                        type: 'ScriptletInjectionRuleBody',
                        ...context.getFullRange(),
                        children: [
                            {
                                type: 'ParameterList',
                                ...context.getRangeFor(String.raw`foo, /a,b/, bar`),
                                children: [
                                    {
                                        type: 'Value',
                                        ...context.getRangeFor(String.raw`foo`),
                                        value: String.raw`foo`,
                                    },
                                    {
                                        type: 'Value',
                                        ...context.getRangeFor(String.raw`/a`),
                                        value: String.raw`/a`,
                                    },
                                    {
                                        type: 'Value',
                                        ...context.getRangeFor(String.raw`b/`),
                                        value: String.raw`b/`,
                                    },
                                    {
                                        type: 'Value',
                                        ...context.getRangeFor(String.raw`bar`),
                                        value: String.raw`bar`,
                                    },
                                ],
                            },
                        ],
                    };
                },
            },
            {
                actual: String.raw`+js(foo, /a\,b/, bar)`,
                expected: (context: NodeExpectContext): ScriptletInjectionRuleBody => {
                    return {
                        type: 'ScriptletInjectionRuleBody',
                        ...context.getFullRange(),
                        children: [
                            {
                                type: 'ParameterList',
                                ...context.getRangeFor(String.raw`foo, /a\,b/, bar`),
                                children: [
                                    {
                                        type: 'Value',
                                        ...context.getRangeFor(String.raw`foo`),
                                        value: String.raw`foo`,
                                    },
                                    {
                                        type: 'Value',
                                        ...context.getRangeFor(String.raw`/a\,b/`),
                                        value: String.raw`/a\,b/`,
                                    },
                                    {
                                        type: 'Value',
                                        ...context.getRangeFor(String.raw`bar`),
                                        value: String.raw`bar`,
                                    },
                                ],
                            },
                        ],
                    };
                },
            },

            // should handle other quotes in quoted arguments
            {
                actual: String.raw`+js(foo, 'a"b"c', bar)`,
                expected: (context: NodeExpectContext): ScriptletInjectionRuleBody => {
                    return {
                        type: 'ScriptletInjectionRuleBody',
                        ...context.getFullRange(),
                        children: [
                            {
                                type: 'ParameterList',
                                ...context.getRangeFor(String.raw`foo, 'a"b"c', bar`),
                                children: [
                                    {
                                        type: 'Value',
                                        ...context.getRangeFor(String.raw`foo`),
                                        value: String.raw`foo`,
                                    },
                                    {
                                        type: 'Value',
                                        ...context.getRangeFor(String.raw`'a"b"c'`),
                                        value: String.raw`'a"b"c'`,
                                    },
                                    {
                                        type: 'Value',
                                        ...context.getRangeFor(String.raw`bar`),
                                        value: String.raw`bar`,
                                    },
                                ],
                            },
                        ],
                    };
                },
            },
            {
                actual: String.raw`+js(foo, 'a\'b\'c', bar)`,
                expected: (context: NodeExpectContext): ScriptletInjectionRuleBody => {
                    return {
                        type: 'ScriptletInjectionRuleBody',
                        ...context.getFullRange(),
                        children: [
                            {
                                type: 'ParameterList',
                                ...context.getRangeFor(String.raw`foo, 'a\'b\'c', bar`),
                                children: [
                                    {
                                        type: 'Value',
                                        ...context.getRangeFor(String.raw`foo`),
                                        value: String.raw`foo`,
                                    },
                                    {
                                        type: 'Value',
                                        ...context.getRangeFor(String.raw`'a\'b\'c'`),
                                        value: String.raw`'a\'b\'c'`,
                                    },
                                    {
                                        type: 'Value',
                                        ...context.getRangeFor(String.raw`bar`),
                                        value: String.raw`bar`,
                                    },
                                ],
                            },
                        ],
                    };
                },
            },

            // should handle if an argument opens with a quote, but doesn't closed properly
            // in this case, we should avoid parsing second argument as `'bar, '`, since the second quote
            // is not followed by a comma
            {
                actual: String.raw`+js(foo, 'bar, 'baz)`,
                expected: (context: NodeExpectContext): ScriptletInjectionRuleBody => {
                    return {
                        type: 'ScriptletInjectionRuleBody',
                        ...context.getFullRange(),
                        children: [
                            {
                                type: 'ParameterList',
                                ...context.getRangeFor(String.raw`foo, 'bar, 'baz`),
                                children: [
                                    {
                                        type: 'Value',
                                        ...context.getRangeFor(String.raw`foo`),
                                        value: String.raw`foo`,
                                    },
                                    {
                                        type: 'Value',
                                        ...context.getRangeFor(String.raw`'bar`),
                                        value: String.raw`'bar`,
                                    },
                                    {
                                        type: 'Value',
                                        ...context.getRangeFor(String.raw`'baz`),
                                        value: String.raw`'baz`,
                                    },
                                ],
                            },
                        ],
                    };
                },
            },

            // should handle backtick quote
            {
                actual: '+js(foo, `bar`)',
                expected: (context: NodeExpectContext): ScriptletInjectionRuleBody => {
                    return {
                        type: 'ScriptletInjectionRuleBody',
                        ...context.getFullRange(),
                        children: [
                            {
                                type: 'ParameterList',
                                ...context.getRangeFor('foo, `bar`'),
                                children: [
                                    {
                                        type: 'Value',
                                        ...context.getRangeFor(String.raw`foo`),
                                        value: String.raw`foo`,
                                    },
                                    {
                                        type: 'Value',
                                        ...context.getRangeFor('`bar`'),
                                        value: '`bar`',
                                    },
                                ],
                            },
                        ],
                    };
                },
            },
        ])("should parse '$actual'", ({ actual, expected: expectedFn }) => {
            // eslint-disable-next-line max-len
            expect(UboScriptletInjectionBodyParser.parse(actual)).toMatchObject(expectedFn(new NodeExpectContext(actual)));
        });
    });

    describe('UboScriptletInjectionBodyParser.parse - invalid cases', () => {
        test.each<{ actual: string; expected: NodeExpectFn<AdblockSyntaxError> }>([
            {
                actual: String.raw`aaa`,
                //                 ~~~
                expected: (context: NodeExpectContext): AdblockSyntaxError => {
                    return new AdblockSyntaxError(
                        UboScriptletInjectionBodyParser.ERROR_MESSAGES.NO_SCRIPTLET_MASK,
                        ...context.toTuple(context.getFullRange()),
                    );
                },
            },

            {
                actual: String.raw`+js`,
                //                   ~
                expected: (context: NodeExpectContext): AdblockSyntaxError => {
                    return new AdblockSyntaxError(
                        UboScriptletInjectionBodyParser.ERROR_MESSAGES.NO_OPENING_PARENTHESIS,
                        context.actual.length,
                        context.actual.length,
                    );
                },
            },
            {
                actual: String.raw`+jsarg0`,
                //                    ~~~~
                expected: (context: NodeExpectContext): AdblockSyntaxError => {
                    return new AdblockSyntaxError(
                        UboScriptletInjectionBodyParser.ERROR_MESSAGES.NO_OPENING_PARENTHESIS,
                        ...context.toTuple(context.getRangeFor(String.raw`arg0`)),
                    );
                },
            },

            {
                actual: String.raw`+js ('scriptlet')`,
                //                    ~~~~~~~~~~~~~~
                expected: (context: NodeExpectContext): AdblockSyntaxError => {
                    return new AdblockSyntaxError(
                        UboScriptletInjectionBodyParser.ERROR_MESSAGES.WHITESPACE_AFTER_MASK,
                        ...context.toTuple(context.getRangeFor(String.raw` ('scriptlet')`)),
                    );
                },
            },

            {
                actual: String.raw`+js('scriptlet'`,
                //                    ~~~~~~~~~~~
                expected: (context: NodeExpectContext): AdblockSyntaxError => {
                    return new AdblockSyntaxError(
                        UboScriptletInjectionBodyParser.ERROR_MESSAGES.NO_CLOSING_PARENTHESIS,
                        ...context.toTuple(context.getRangeFor(String.raw`('scriptlet'`)),
                    );
                },
            },
            {
                actual: String.raw`+js('scriptlet'\)`,
                //                    ~~~~~~~~~~~~~~
                expected: (context: NodeExpectContext): AdblockSyntaxError => {
                    return new AdblockSyntaxError(
                        UboScriptletInjectionBodyParser.ERROR_MESSAGES.NO_CLOSING_PARENTHESIS,
                        ...context.toTuple(context.getRangeFor(String.raw`('scriptlet'\)`)),
                    );
                },
            },

            {
                actual: String.raw`+js(, 'arg0')`,
                //                    ~~~~~~~~~~
                expected: (context: NodeExpectContext): AdblockSyntaxError => {
                    return new AdblockSyntaxError(
                        UboScriptletInjectionBodyParser.ERROR_MESSAGES.NO_SCRIPTLET_NAME,
                        ...context.toTuple(context.getRangeFor(String.raw`(, 'arg0')`)),
                    );
                },
            },
            {
                actual: String.raw`+js( , 'arg0')`,
                //                    ~~~~~~~~~~~
                expected: (context: NodeExpectContext): AdblockSyntaxError => {
                    return new AdblockSyntaxError(
                        UboScriptletInjectionBodyParser.ERROR_MESSAGES.NO_SCRIPTLET_NAME,
                        ...context.toTuple(context.getRangeFor(String.raw`( , 'arg0')`)),
                    );
                },
            },
        ])("should throw on input: '$actual'", ({ actual, expected: expectedFn }) => {
            const fn = vi.fn(() => UboScriptletInjectionBodyParser.parse(actual));

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

    describe('UboScriptletInjectionBodyParser.generate', () => {
        test.each<{ actual: string; expected: string }>([
            {
                actual: String.raw`+js()`,
                expected: String.raw`+js()`,
            },
            {
                actual: String.raw`+js( )`,
                expected: String.raw`+js()`,
            },

            {
                actual: String.raw`+js('a\'b')`,
                expected: String.raw`+js('a\'b')`,
            },
            {
                actual: String.raw`+js("a\"b")`,
                expected: String.raw`+js("a\"b")`,
            },

            {
                actual: String.raw`+js('a"b')`,
                expected: String.raw`+js('a"b')`,
            },
            {
                actual: String.raw`+js("a'b")`,
                expected: String.raw`+js("a'b")`,
            },

            {
                actual: String.raw`+js( scriptlet0 )`,
                expected: String.raw`+js(scriptlet0)`,
            },
            {
                actual: String.raw`+js( scriptlet0 , arg0 )`,
                expected: String.raw`+js(scriptlet0, arg0)`,
            },
            {
                actual: String.raw`+js(scriptlet0, arg0, arg1)`,
                expected: String.raw`+js(scriptlet0, arg0, arg1)`,
            },
            {
                actual: String.raw`+js(scriptlet0, arg00\,arg01, arg1)`,
                expected: String.raw`+js(scriptlet0, arg00\,arg01, arg1)`,
            },
            {
                actual: String.raw`+js(scriptlet0, 'arg0', "arg1", /arg2/, arg3)`,
                expected: String.raw`+js(scriptlet0, 'arg0', "arg1", /arg2/, arg3)`,
            },
            {
                actual: String.raw`+js(scriptlet0, 'ar\'g0', "ar\"g1", /ar\/g2/)`,
                expected: String.raw`+js(scriptlet0, 'ar\'g0', "ar\"g1", /ar\/g2/)`,
            },

            {
                actual: String.raw`+js('scriptlet0')`,
                expected: String.raw`+js('scriptlet0')`,
            },
            {
                actual: String.raw`+js("scriptlet0")`,
                expected: String.raw`+js("scriptlet0")`,
            },
            {
                actual: String.raw`+js('scriptlet0', 'arg0', 'arg1')`,
                expected: String.raw`+js('scriptlet0', 'arg0', 'arg1')`,
            },
            {
                actual: String.raw`+js("scriptlet0", "arg0", "arg1")`,
                expected: String.raw`+js("scriptlet0", "arg0", "arg1")`,
            },
            {
                actual: String.raw`+js(a)`,
                expected: String.raw`+js(a)`,
            },
            {
                actual: String.raw`+js(a,)`,
                expected: String.raw`+js(a, )`,
            },
            {
                actual: String.raw`+js(a,b)`,
                expected: String.raw`+js(a, b)`,
            },
            {
                actual: String.raw`+js(trusted-set-cookie, cookies, '{"foo":1,"bar":0}')`,
                expected: String.raw`+js(trusted-set-cookie, cookies, '{"foo":1,"bar":0}')`,
            },
            {
                actual: String.raw`+js(foo, 'a\'b\'c', bar)`,
                expected: String.raw`+js(foo, 'a\'b\'c', bar)`,
            },
            {
                actual: String.raw`+js(foo, 'bar, 'baz)`,
                expected: String.raw`+js(foo, 'bar, 'baz)`,
            },
            {
                actual: '+js(foo, `bar`)',
                expected: '+js(foo, `bar`)',
            },
        ])("should generate '$expected' from '$actual'", ({ actual, expected }) => {
            const ruleNode = UboScriptletInjectionBodyParser.parse(actual);

            if (ruleNode === null) {
                throw new Error(`Failed to parse '${actual}' as cosmetic rule`);
            }

            expect(UboScriptletInjectionBodyGenerator.generate(ruleNode)).toBe(expected);
        });
    });

    describe('serialize & deserialize', () => {
        test.each([
            '+js()',
            "+js('scriptlet0')",
            "+js('scriptlet0', 'arg0', 'arg1')",
            '+js(scriptlet0, arg0, arg1)',
        ])("should serialize and deserialize '%p'", async (input) => {
            await expect(input).toBeSerializedAndDeserializedProperly(
                UboScriptletInjectionBodyParser,
                UboScriptletInjectionBodyGenerator,
                UboScriptletInjectionBodySerializer,
                UboScriptletInjectionBodyDeserializer,
            );
        });
    });
});
