import { ScriptletInjectionBodyParser } from '../../../../src/parser/cosmetic/body/scriptlet';
import { AdblockSyntax } from '../../../../src/utils/adblockers';
import {
    CLOSE_PARENTHESIS,
    EMPTY,
    OPEN_PARENTHESIS,
    SPACE,
} from '../../../../src/utils/constants';

describe('ScriptletInjectionBodyParser', () => {
    test('parseAdgAndUboScriptletCall', () => {
        expect(
            ScriptletInjectionBodyParser.parseAdgAndUboScriptletCall('js(scriptlet0)'),
        ).toMatchObject({
            type: 'ScriptletInjectionRuleBody',
            loc: {
                start: {
                    offset: 0,
                    line: 1,
                    column: 1,
                },
                end: {
                    offset: 14,
                    line: 1,
                    column: 15,
                },
            },
            children: [
                {
                    type: 'ParameterList',
                    loc: {
                        start: {
                            offset: 3,
                            line: 1,
                            column: 4,
                        },
                        end: {
                            offset: 13,
                            line: 1,
                            column: 14,
                        },
                    },
                    children: [
                        {
                            type: 'Parameter',
                            loc: {
                                start: {
                                    offset: 3,
                                    line: 1,
                                    column: 4,
                                },
                                end: {
                                    offset: 13,
                                    line: 1,
                                    column: 14,
                                },
                            },
                            value: 'scriptlet0',
                        },
                    ],
                },
            ],
        });

        expect(
            ScriptletInjectionBodyParser.parseAdgAndUboScriptletCall('//scriptlet(scriptlet0)'),
        ).toMatchObject({
            type: 'ScriptletInjectionRuleBody',
            loc: {
                start: {
                    offset: 0,
                    line: 1,
                    column: 1,
                },
                end: {
                    offset: 23,
                    line: 1,
                    column: 24,
                },
            },
            children: [
                {
                    type: 'ParameterList',
                    loc: {
                        start: {
                            offset: 12,
                            line: 1,
                            column: 13,
                        },
                        end: {
                            offset: 22,
                            line: 1,
                            column: 23,
                        },
                    },
                    children: [
                        {
                            type: 'Parameter',
                            loc: {
                                start: {
                                    offset: 12,
                                    line: 1,
                                    column: 13,
                                },
                                end: {
                                    offset: 22,
                                    line: 1,
                                    column: 23,
                                },
                            },
                            value: 'scriptlet0',
                        },
                    ],
                },
            ],
        });

        expect(ScriptletInjectionBodyParser.parseAdgAndUboScriptletCall('js(scriptlet0,arg0)')).toMatchObject({
            type: 'ScriptletInjectionRuleBody',
            loc: {
                start: {
                    offset: 0,
                    line: 1,
                    column: 1,
                },
                end: {
                    offset: 19,
                    line: 1,
                    column: 20,
                },
            },
            children: [
                {
                    type: 'ParameterList',
                    loc: {
                        start: {
                            offset: 3,
                            line: 1,
                            column: 4,
                        },
                        end: {
                            offset: 18,
                            line: 1,
                            column: 19,
                        },
                    },
                    children: [
                        {
                            type: 'Parameter',
                            loc: {
                                start: {
                                    offset: 3,
                                    line: 1,
                                    column: 4,
                                },
                                end: {
                                    offset: 13,
                                    line: 1,
                                    column: 14,
                                },
                            },
                            value: 'scriptlet0',
                        },
                        {
                            type: 'Parameter',
                            loc: {
                                start: {
                                    offset: 14,
                                    line: 1,
                                    column: 15,
                                },
                                end: {
                                    offset: 18,
                                    line: 1,
                                    column: 19,
                                },
                            },
                            value: 'arg0',
                        },
                    ],
                },
            ],
        });

        // Spaces
        expect(ScriptletInjectionBodyParser.parseAdgAndUboScriptletCall('js(scriptlet0, arg0)')).toMatchObject({
            type: 'ScriptletInjectionRuleBody',
            loc: {
                start: {
                    offset: 0,
                    line: 1,
                    column: 1,
                },
                end: {
                    offset: 20,
                    line: 1,
                    column: 21,
                },
            },
            children: [
                {
                    type: 'ParameterList',
                    loc: {
                        start: {
                            offset: 3,
                            line: 1,
                            column: 4,
                        },
                        end: {
                            offset: 19,
                            line: 1,
                            column: 20,
                        },
                    },
                    children: [
                        {
                            type: 'Parameter',
                            loc: {
                                start: {
                                    offset: 3,
                                    line: 1,
                                    column: 4,
                                },
                                end: {
                                    offset: 13,
                                    line: 1,
                                    column: 14,
                                },
                            },
                            value: 'scriptlet0',
                        },
                        {
                            type: 'Parameter',
                            loc: {
                                start: {
                                    offset: 15,
                                    line: 1,
                                    column: 16,
                                },
                                end: {
                                    offset: 19,
                                    line: 1,
                                    column: 20,
                                },
                            },
                            value: 'arg0',
                        },
                    ],
                },
            ],
        });

        expect(ScriptletInjectionBodyParser.parseAdgAndUboScriptletCall('js( scriptlet0 , arg0 )')).toMatchObject({
            type: 'ScriptletInjectionRuleBody',
            loc: {
                start: {
                    offset: 0,
                    line: 1,
                    column: 1,
                },
                end: {
                    offset: 23,
                    line: 1,
                    column: 24,
                },
            },
            children: [
                {
                    type: 'ParameterList',
                    loc: {
                        start: {
                            offset: 3,
                            line: 1,
                            column: 4,
                        },
                        end: {
                            offset: 22,
                            line: 1,
                            column: 23,
                        },
                    },
                    children: [
                        {
                            type: 'Parameter',
                            loc: {
                                start: {
                                    offset: 4,
                                    line: 1,
                                    column: 5,
                                },
                                end: {
                                    offset: 14,
                                    line: 1,
                                    column: 15,
                                },
                            },
                            value: 'scriptlet0',
                        },
                        {
                            type: 'Parameter',
                            loc: {
                                start: {
                                    offset: 17,
                                    line: 1,
                                    column: 18,
                                },
                                end: {
                                    offset: 21,
                                    line: 1,
                                    column: 22,
                                },
                            },
                            value: 'arg0',
                        },
                    ],
                },
            ],
        });

        expect(
            ScriptletInjectionBodyParser.parseAdgAndUboScriptletCall('js(scriptlet0, arg0, arg1, arg2)'),
        ).toMatchObject({
            type: 'ScriptletInjectionRuleBody',
            loc: {
                start: {
                    offset: 0,
                    line: 1,
                    column: 1,
                },
                end: {
                    offset: 32,
                    line: 1,
                    column: 33,
                },
            },
            children: [
                {
                    type: 'ParameterList',
                    loc: {
                        start: {
                            offset: 3,
                            line: 1,
                            column: 4,
                        },
                        end: {
                            offset: 31,
                            line: 1,
                            column: 32,
                        },
                    },
                    children: [
                        {
                            type: 'Parameter',
                            loc: {
                                start: {
                                    offset: 3,
                                    line: 1,
                                    column: 4,
                                },
                                end: {
                                    offset: 13,
                                    line: 1,
                                    column: 14,
                                },
                            },
                            value: 'scriptlet0',
                        },
                        {
                            type: 'Parameter',
                            loc: {
                                start: {
                                    offset: 15,
                                    line: 1,
                                    column: 16,
                                },
                                end: {
                                    offset: 19,
                                    line: 1,
                                    column: 20,
                                },
                            },
                            value: 'arg0',
                        },
                        {
                            type: 'Parameter',
                            loc: {
                                start: {
                                    offset: 21,
                                    line: 1,
                                    column: 22,
                                },
                                end: {
                                    offset: 25,
                                    line: 1,
                                    column: 26,
                                },
                            },
                            value: 'arg1',
                        },
                        {
                            type: 'Parameter',
                            loc: {
                                start: {
                                    offset: 27,
                                    line: 1,
                                    column: 28,
                                },
                                end: {
                                    offset: 31,
                                    line: 1,
                                    column: 32,
                                },
                            },
                            value: 'arg2',
                        },
                    ],
                },
            ],
        });

        expect(
            ScriptletInjectionBodyParser.parseAdgAndUboScriptletCall("js(scriptlet0, 'arg0', \"arg1\", /arg2/, arg3)"),
        ).toMatchObject({
            type: 'ScriptletInjectionRuleBody',
            loc: {
                start: {
                    offset: 0,
                    line: 1,
                    column: 1,
                },
                end: {
                    offset: 44,
                    line: 1,
                    column: 45,
                },
            },
            children: [
                {
                    type: 'ParameterList',
                    loc: {
                        start: {
                            offset: 3,
                            line: 1,
                            column: 4,
                        },
                        end: {
                            offset: 43,
                            line: 1,
                            column: 44,
                        },
                    },
                    children: [
                        {
                            type: 'Parameter',
                            loc: {
                                start: {
                                    offset: 3,
                                    line: 1,
                                    column: 4,
                                },
                                end: {
                                    offset: 13,
                                    line: 1,
                                    column: 14,
                                },
                            },
                            value: 'scriptlet0',
                        },
                        {
                            type: 'Parameter',
                            loc: {
                                start: {
                                    offset: 15,
                                    line: 1,
                                    column: 16,
                                },
                                end: {
                                    offset: 21,
                                    line: 1,
                                    column: 22,
                                },
                            },
                            value: "'arg0'",
                        },
                        {
                            type: 'Parameter',
                            loc: {
                                start: {
                                    offset: 23,
                                    line: 1,
                                    column: 24,
                                },
                                end: {
                                    offset: 29,
                                    line: 1,
                                    column: 30,
                                },
                            },
                            value: '"arg1"',
                        },
                        {
                            type: 'Parameter',
                            loc: {
                                start: {
                                    offset: 31,
                                    line: 1,
                                    column: 32,
                                },
                                end: {
                                    offset: 37,
                                    line: 1,
                                    column: 38,
                                },
                            },
                            value: '/arg2/',
                        },
                        {
                            type: 'Parameter',
                            loc: {
                                start: {
                                    offset: 39,
                                    line: 1,
                                    column: 40,
                                },
                                end: {
                                    offset: 43,
                                    line: 1,
                                    column: 44,
                                },
                            },
                            value: 'arg3',
                        },
                    ],
                },
            ],
        });

        expect(
            ScriptletInjectionBodyParser.parseAdgAndUboScriptletCall(
                "js(scriptlet0, 'ar\\'g0', \"ar\\\"g1\", /ar\\/g2/)",
            ),
        ).toMatchObject({
            type: 'ScriptletInjectionRuleBody',
            loc: {
                start: {
                    offset: 0,
                    line: 1,
                    column: 1,
                },
                end: {
                    offset: 44,
                    line: 1,
                    column: 45,
                },
            },
            children: [
                {
                    type: 'ParameterList',
                    loc: {
                        start: {
                            offset: 3,
                            line: 1,
                            column: 4,
                        },
                        end: {
                            offset: 43,
                            line: 1,
                            column: 44,
                        },
                    },
                    children: [
                        {
                            type: 'Parameter',
                            loc: {
                                start: {
                                    offset: 3,
                                    line: 1,
                                    column: 4,
                                },
                                end: {
                                    offset: 13,
                                    line: 1,
                                    column: 14,
                                },
                            },
                            value: 'scriptlet0',
                        },
                        {
                            type: 'Parameter',
                            loc: {
                                start: {
                                    offset: 15,
                                    line: 1,
                                    column: 16,
                                },
                                end: {
                                    offset: 23,
                                    line: 1,
                                    column: 24,
                                },
                            },
                            value: "'ar\\'g0'",
                        },
                        {
                            type: 'Parameter',
                            loc: {
                                start: {
                                    offset: 25,
                                    line: 1,
                                    column: 26,
                                },
                                end: {
                                    offset: 33,
                                    line: 1,
                                    column: 34,
                                },
                            },
                            value: '"ar\\"g1"',
                        },
                        {
                            type: 'Parameter',
                            loc: {
                                start: {
                                    offset: 35,
                                    line: 1,
                                    column: 36,
                                },
                                end: {
                                    offset: 43,
                                    line: 1,
                                    column: 44,
                                },
                            },
                            value: '/ar\\/g2/',
                        },
                    ],
                },
            ],
        });

        // Scriptlet call should start with "js" or "//scriptlet" marker
        expect(
            () => ScriptletInjectionBodyParser.parseAdgAndUboScriptletCall('()'),
        ).toThrowError(
            'Invalid AdGuard/uBlock scriptlet call, no scriptlet call mask \'//scriptlet\' or \'js\' found',
        );

        // Scriptlet cannot be empty
        expect(
            () => ScriptletInjectionBodyParser.parseAdgAndUboScriptletCall('js()'),
        ).not.toThrowError();

        expect(
            () => ScriptletInjectionBodyParser.parseAdgAndUboScriptletCall('//scriptlet()'),
        ).not.toThrowError();

        expect(
            () => ScriptletInjectionBodyParser.parseAdgAndUboScriptletCall('js( )'),
        ).not.toThrowError();

        expect(
            () => ScriptletInjectionBodyParser.parseAdgAndUboScriptletCall('//scriptlet( )'),
        ).not.toThrowError();

        expect(
            () => ScriptletInjectionBodyParser.parseAdgAndUboScriptletCall('js(,arg0)'),
        ).toThrowError(
            'Invalid AdGuard/uBlock scriptlet call, no scriptlet name specified',
        );

        expect(
            () => ScriptletInjectionBodyParser.parseAdgAndUboScriptletCall('//scriptlet(,arg0)'),
        ).toThrowError(
            'Invalid AdGuard/uBlock scriptlet call, no scriptlet name specified',
        );

        expect(
            () => ScriptletInjectionBodyParser.parseAdgAndUboScriptletCall('js( , arg0)'),
        ).toThrowError(
            'Invalid AdGuard/uBlock scriptlet call, no scriptlet name specified',
        );

        expect(
            () => ScriptletInjectionBodyParser.parseAdgAndUboScriptletCall('//scriptlet( , arg0)'),
        ).toThrowError(
            'Invalid AdGuard/uBlock scriptlet call, no scriptlet name specified',
        );

        expect(
            () => ScriptletInjectionBodyParser.parseAdgAndUboScriptletCall('//scriptlet (a)'),
        ).toThrowError(
            'Invalid AdGuard/uBlock scriptlet call, whitespace is not allowed after the scriptlet call mask',
        );

        expect(
            () => ScriptletInjectionBodyParser.parseAdgAndUboScriptletCall('js (a)'),
        ).toThrowError(
            'Invalid AdGuard/uBlock scriptlet call, whitespace is not allowed after the scriptlet call mask',
        );

        expect(
            () => ScriptletInjectionBodyParser.parseAdgAndUboScriptletCall('//scriptlet'),
        ).toThrowError(
            `Invalid AdGuard/uBlock scriptlet call, no opening parentheses '${OPEN_PARENTHESIS}' found`,
        );

        expect(
            () => ScriptletInjectionBodyParser.parseAdgAndUboScriptletCall('//scriptletarg0'),
        ).toThrowError(
            `Invalid AdGuard/uBlock scriptlet call, no opening parentheses '${OPEN_PARENTHESIS}' found`,
        );

        expect(
            () => ScriptletInjectionBodyParser.parseAdgAndUboScriptletCall('js'),
        ).toThrowError(
            `Invalid AdGuard/uBlock scriptlet call, no opening parentheses '${OPEN_PARENTHESIS}' found`,
        );

        expect(
            () => ScriptletInjectionBodyParser.parseAdgAndUboScriptletCall('jsarg0'),
        ).toThrowError(
            `Invalid AdGuard/uBlock scriptlet call, no opening parentheses '${OPEN_PARENTHESIS}' found`,
        );

        expect(
            () => ScriptletInjectionBodyParser.parseAdgAndUboScriptletCall('//scriptlet(arg0'),
        ).toThrowError(
            `Invalid AdGuard/uBlock scriptlet call, no closing parentheses '${CLOSE_PARENTHESIS}' found`,
        );

        expect(
            () => ScriptletInjectionBodyParser.parseAdgAndUboScriptletCall('//scriptlet(arg0, '),
        ).toThrowError(
            `Invalid AdGuard/uBlock scriptlet call, no closing parentheses '${CLOSE_PARENTHESIS}' found`,
        );

        expect(
            () => ScriptletInjectionBodyParser.parseAdgAndUboScriptletCall('js(arg0'),
        ).toThrowError(
            `Invalid AdGuard/uBlock scriptlet call, no closing parentheses '${CLOSE_PARENTHESIS}' found`,
        );

        expect(
            () => ScriptletInjectionBodyParser.parseAdgAndUboScriptletCall('js(arg0, '),
        ).toThrowError(
            `Invalid AdGuard/uBlock scriptlet call, no closing parentheses '${CLOSE_PARENTHESIS}' found`,
        );

        expect(
            () => ScriptletInjectionBodyParser.parseAdgAndUboScriptletCall('//scriptlet(arg0)a'),
        ).toThrowError(
            // eslint-disable-next-line max-len
            `Invalid AdGuard/uBlock scriptlet call, no closing parentheses '${CLOSE_PARENTHESIS}' found`,
        );

        expect(
            () => ScriptletInjectionBodyParser.parseAdgAndUboScriptletCall('//scriptlet(arg0) a'),
        ).toThrowError(
            // eslint-disable-next-line max-len
            `Invalid AdGuard/uBlock scriptlet call, no closing parentheses '${CLOSE_PARENTHESIS}' found`,
        );

        expect(
            () => ScriptletInjectionBodyParser.parseAdgAndUboScriptletCall(String.raw`//scriptlet(arg0\)`),
        ).toThrowError(
            // eslint-disable-next-line max-len
            `Invalid AdGuard/uBlock scriptlet call, no closing parentheses '${CLOSE_PARENTHESIS}' found`,
        );

        expect(
            () => ScriptletInjectionBodyParser.parseAdgAndUboScriptletCall('js(arg0)a'),
        ).toThrowError(
            // eslint-disable-next-line max-len
            `Invalid AdGuard/uBlock scriptlet call, no closing parentheses '${CLOSE_PARENTHESIS}' found`,
        );

        expect(
            () => ScriptletInjectionBodyParser.parseAdgAndUboScriptletCall('js(arg0) a'),
        ).toThrowError(
            // eslint-disable-next-line max-len
            `Invalid AdGuard/uBlock scriptlet call, no closing parentheses '${CLOSE_PARENTHESIS}' found`,
        );

        expect(
            () => ScriptletInjectionBodyParser.parseAdgAndUboScriptletCall(String.raw`js(arg0\)`),
        ).toThrowError(
            // eslint-disable-next-line max-len
            `Invalid AdGuard/uBlock scriptlet call, no closing parentheses '${CLOSE_PARENTHESIS}' found`,
        );
    });

    test('parseAbpSnippetCall', () => {
        expect(ScriptletInjectionBodyParser.parseAbpSnippetCall('scriptlet0')).toMatchObject({
            type: 'ScriptletInjectionRuleBody',
            loc: {
                start: {
                    offset: 0,
                    line: 1,
                    column: 1,
                },
                end: {
                    offset: 10,
                    line: 1,
                    column: 11,
                },
            },
            children: [
                {
                    type: 'ParameterList',
                    loc: {
                        start: {
                            offset: 0,
                            line: 1,
                            column: 1,
                        },
                        end: {
                            offset: 10,
                            line: 1,
                            column: 11,
                        },
                    },
                    children: [
                        {
                            type: 'Parameter',
                            loc: {
                                start: {
                                    offset: 0,
                                    line: 1,
                                    column: 1,
                                },
                                end: {
                                    offset: 10,
                                    line: 1,
                                    column: 11,
                                },
                            },
                            value: 'scriptlet0',
                        },
                    ],
                },
            ],
        });

        expect(ScriptletInjectionBodyParser.parseAbpSnippetCall('scriptlet0 arg0')).toMatchObject({
            type: 'ScriptletInjectionRuleBody',
            loc: {
                start: {
                    offset: 0,
                    line: 1,
                    column: 1,
                },
                end: {
                    offset: 15,
                    line: 1,
                    column: 16,
                },
            },
            children: [
                {
                    type: 'ParameterList',
                    loc: {
                        start: {
                            offset: 0,
                            line: 1,
                            column: 1,
                        },
                        end: {
                            offset: 15,
                            line: 1,
                            column: 16,
                        },
                    },
                    children: [
                        {
                            type: 'Parameter',
                            loc: {
                                start: {
                                    offset: 0,
                                    line: 1,
                                    column: 1,
                                },
                                end: {
                                    offset: 10,
                                    line: 1,
                                    column: 11,
                                },
                            },
                            value: 'scriptlet0',
                        },
                        {
                            type: 'Parameter',
                            loc: {
                                start: {
                                    offset: 11,
                                    line: 1,
                                    column: 12,
                                },
                                end: {
                                    offset: 15,
                                    line: 1,
                                    column: 16,
                                },
                            },
                            value: 'arg0',
                        },
                    ],
                },
            ],
        });

        expect(ScriptletInjectionBodyParser.parseAbpSnippetCall('scriptlet0 arg0 arg1')).toMatchObject({
            type: 'ScriptletInjectionRuleBody',
            loc: {
                start: {
                    offset: 0,
                    line: 1,
                    column: 1,
                },
                end: {
                    offset: 20,
                    line: 1,
                    column: 21,
                },
            },
            children: [
                {
                    type: 'ParameterList',
                    loc: {
                        start: {
                            offset: 0,
                            line: 1,
                            column: 1,
                        },
                        end: {
                            offset: 20,
                            line: 1,
                            column: 21,
                        },
                    },
                    children: [
                        {
                            type: 'Parameter',
                            loc: {
                                start: {
                                    offset: 0,
                                    line: 1,
                                    column: 1,
                                },
                                end: {
                                    offset: 10,
                                    line: 1,
                                    column: 11,
                                },
                            },
                            value: 'scriptlet0',
                        },
                        {
                            type: 'Parameter',
                            loc: {
                                start: {
                                    offset: 11,
                                    line: 1,
                                    column: 12,
                                },
                                end: {
                                    offset: 15,
                                    line: 1,
                                    column: 16,
                                },
                            },
                            value: 'arg0',
                        },
                        {
                            type: 'Parameter',
                            loc: {
                                start: {
                                    offset: 16,
                                    line: 1,
                                    column: 17,
                                },
                                end: {
                                    offset: 20,
                                    line: 1,
                                    column: 21,
                                },
                            },
                            value: 'arg1',
                        },
                    ],
                },
            ],
        });

        // Escaped space
        expect(ScriptletInjectionBodyParser.parseAbpSnippetCall('scriptlet0 arg0\\ arg1 arg2')).toMatchObject({
            type: 'ScriptletInjectionRuleBody',
            loc: {
                start: {
                    offset: 0,
                    line: 1,
                    column: 1,
                },
                end: {
                    offset: 26,
                    line: 1,
                    column: 27,
                },
            },
            children: [
                {
                    type: 'ParameterList',
                    loc: {
                        start: {
                            offset: 0,
                            line: 1,
                            column: 1,
                        },
                        end: {
                            offset: 26,
                            line: 1,
                            column: 27,
                        },
                    },
                    children: [
                        {
                            type: 'Parameter',
                            loc: {
                                start: {
                                    offset: 0,
                                    line: 1,
                                    column: 1,
                                },
                                end: {
                                    offset: 10,
                                    line: 1,
                                    column: 11,
                                },
                            },
                            value: 'scriptlet0',
                        },
                        {
                            type: 'Parameter',
                            loc: {
                                start: {
                                    offset: 11,
                                    line: 1,
                                    column: 12,
                                },
                                end: {
                                    offset: 21,
                                    line: 1,
                                    column: 22,
                                },
                            },
                            value: 'arg0\\ arg1',
                        },
                        {
                            type: 'Parameter',
                            loc: {
                                start: {
                                    offset: 22,
                                    line: 1,
                                    column: 23,
                                },
                                end: {
                                    offset: 26,
                                    line: 1,
                                    column: 27,
                                },
                            },
                            value: 'arg2',
                        },
                    ],
                },
            ],
        });

        // ; at end
        expect(ScriptletInjectionBodyParser.parseAbpSnippetCall('scriptlet0 arg0 arg1;')).toMatchObject({
            type: 'ScriptletInjectionRuleBody',
            loc: {
                start: {
                    offset: 0,
                    line: 1,
                    column: 1,
                },
                end: {
                    offset: 21,
                    line: 1,
                    column: 22,
                },
            },
            children: [
                {
                    type: 'ParameterList',
                    loc: {
                        start: {
                            offset: 0,
                            line: 1,
                            column: 1,
                        },
                        end: {
                            offset: 20,
                            line: 1,
                            column: 21,
                        },
                    },
                    children: [
                        {
                            type: 'Parameter',
                            loc: {
                                start: {
                                    offset: 0,
                                    line: 1,
                                    column: 1,
                                },
                                end: {
                                    offset: 10,
                                    line: 1,
                                    column: 11,
                                },
                            },
                            value: 'scriptlet0',
                        },
                        {
                            type: 'Parameter',
                            loc: {
                                start: {
                                    offset: 11,
                                    line: 1,
                                    column: 12,
                                },
                                end: {
                                    offset: 15,
                                    line: 1,
                                    column: 16,
                                },
                            },
                            value: 'arg0',
                        },
                        {
                            type: 'Parameter',
                            loc: {
                                start: {
                                    offset: 16,
                                    line: 1,
                                    column: 17,
                                },
                                end: {
                                    offset: 20,
                                    line: 1,
                                    column: 21,
                                },
                            },
                            value: 'arg1',
                        },
                    ],
                },
            ],
        });

        // Unfinished strings
        expect(ScriptletInjectionBodyParser.parseAbpSnippetCall("scriptlet0 'arg0 arg1;")).toMatchObject({
            type: 'ScriptletInjectionRuleBody',
            loc: {
                start: {
                    offset: 0,
                    line: 1,
                    column: 1,
                },
                end: {
                    offset: 22,
                    line: 1,
                    column: 23,
                },
            },
            children: [
                {
                    type: 'ParameterList',
                    loc: {
                        start: {
                            offset: 0,
                            line: 1,
                            column: 1,
                        },
                        end: {
                            offset: 22,
                            line: 1,
                            column: 23,
                        },
                    },
                    children: [
                        {
                            type: 'Parameter',
                            loc: {
                                start: {
                                    offset: 0,
                                    line: 1,
                                    column: 1,
                                },
                                end: {
                                    offset: 10,
                                    line: 1,
                                    column: 11,
                                },
                            },
                            value: 'scriptlet0',
                        },
                        {
                            type: 'Parameter',
                            loc: {
                                start: {
                                    offset: 11,
                                    line: 1,
                                    column: 12,
                                },
                                end: {
                                    offset: 22,
                                    line: 1,
                                    column: 23,
                                },
                            },
                            value: "'arg0 arg1;",
                        },
                    ],
                },
            ],
        });

        expect(ScriptletInjectionBodyParser.parseAbpSnippetCall('scriptlet0 "arg0 arg1;')).toMatchObject({
            type: 'ScriptletInjectionRuleBody',
            loc: {
                start: {
                    offset: 0,
                    line: 1,
                    column: 1,
                },
                end: {
                    offset: 22,
                    line: 1,
                    column: 23,
                },
            },
            children: [
                {
                    type: 'ParameterList',
                    loc: {
                        start: {
                            offset: 0,
                            line: 1,
                            column: 1,
                        },
                        end: {
                            offset: 22,
                            line: 1,
                            column: 23,
                        },
                    },
                    children: [
                        {
                            type: 'Parameter',
                            loc: {
                                start: {
                                    offset: 0,
                                    line: 1,
                                    column: 1,
                                },
                                end: {
                                    offset: 10,
                                    line: 1,
                                    column: 11,
                                },
                            },
                            value: 'scriptlet0',
                        },
                        {
                            type: 'Parameter',
                            loc: {
                                start: {
                                    offset: 11,
                                    line: 1,
                                    column: 12,
                                },
                                end: {
                                    offset: 22,
                                    line: 1,
                                    column: 23,
                                },
                            },
                            value: '"arg0 arg1;',
                        },
                    ],
                },
            ],
        });

        // Multiple scriptlets
        expect(
            ScriptletInjectionBodyParser.parseAbpSnippetCall('scriptlet0 arg0 arg1; scriptlet1; scriptlet2 arg0'),
        ).toMatchObject({
            type: 'ScriptletInjectionRuleBody',
            loc: {
                start: {
                    offset: 0,
                    line: 1,
                    column: 1,
                },
                end: {
                    offset: 49,
                    line: 1,
                    column: 50,
                },
            },
            children: [
                {
                    type: 'ParameterList',
                    loc: {
                        start: {
                            offset: 0,
                            line: 1,
                            column: 1,
                        },
                        end: {
                            offset: 20,
                            line: 1,
                            column: 21,
                        },
                    },
                    children: [
                        {
                            type: 'Parameter',
                            loc: {
                                start: {
                                    offset: 0,
                                    line: 1,
                                    column: 1,
                                },
                                end: {
                                    offset: 10,
                                    line: 1,
                                    column: 11,
                                },
                            },
                            value: 'scriptlet0',
                        },
                        {
                            type: 'Parameter',
                            loc: {
                                start: {
                                    offset: 11,
                                    line: 1,
                                    column: 12,
                                },
                                end: {
                                    offset: 15,
                                    line: 1,
                                    column: 16,
                                },
                            },
                            value: 'arg0',
                        },
                        {
                            type: 'Parameter',
                            loc: {
                                start: {
                                    offset: 16,
                                    line: 1,
                                    column: 17,
                                },
                                end: {
                                    offset: 20,
                                    line: 1,
                                    column: 21,
                                },
                            },
                            value: 'arg1',
                        },
                    ],
                },
                {
                    type: 'ParameterList',
                    loc: {
                        start: {
                            offset: 22,
                            line: 1,
                            column: 23,
                        },
                        end: {
                            offset: 32,
                            line: 1,
                            column: 33,
                        },
                    },
                    children: [
                        {
                            type: 'Parameter',
                            loc: {
                                start: {
                                    offset: 22,
                                    line: 1,
                                    column: 23,
                                },
                                end: {
                                    offset: 32,
                                    line: 1,
                                    column: 33,
                                },
                            },
                            value: 'scriptlet1',
                        },
                    ],
                },
                {
                    type: 'ParameterList',
                    loc: {
                        start: {
                            offset: 34,
                            line: 1,
                            column: 35,
                        },
                        end: {
                            offset: 49,
                            line: 1,
                            column: 50,
                        },
                    },
                    children: [
                        {
                            type: 'Parameter',
                            loc: {
                                start: {
                                    offset: 34,
                                    line: 1,
                                    column: 35,
                                },
                                end: {
                                    offset: 44,
                                    line: 1,
                                    column: 45,
                                },
                            },
                            value: 'scriptlet2',
                        },
                        {
                            type: 'Parameter',
                            loc: {
                                start: {
                                    offset: 45,
                                    line: 1,
                                    column: 46,
                                },
                                end: {
                                    offset: 49,
                                    line: 1,
                                    column: 50,
                                },
                            },
                            value: 'arg0',
                        },
                    ],
                },
            ],
        });

        expect(ScriptletInjectionBodyParser.parseAbpSnippetCall("scriptlet0 some'thing")).toMatchObject({
            type: 'ScriptletInjectionRuleBody',
            loc: {
                start: {
                    offset: 0,
                    line: 1,
                    column: 1,
                },
                end: {
                    offset: 21,
                    line: 1,
                    column: 22,
                },
            },
            children: [
                {
                    type: 'ParameterList',
                    loc: {
                        start: {
                            offset: 0,
                            line: 1,
                            column: 1,
                        },
                        end: {
                            offset: 21,
                            line: 1,
                            column: 22,
                        },
                    },
                    children: [
                        {
                            type: 'Parameter',
                            loc: {
                                start: {
                                    offset: 0,
                                    line: 1,
                                    column: 1,
                                },
                                end: {
                                    offset: 10,
                                    line: 1,
                                    column: 11,
                                },
                            },
                            value: 'scriptlet0',
                        },
                        {
                            type: 'Parameter',
                            loc: {
                                start: {
                                    offset: 11,
                                    line: 1,
                                    column: 12,
                                },
                                end: {
                                    offset: 21,
                                    line: 1,
                                    column: 22,
                                },
                            },
                            value: "some'thing",
                        },
                    ],
                },
            ],
        });

        // Complicated case
        expect(
            ScriptletInjectionBodyParser.parseAbpSnippetCall(
                "scriptlet0 arg0 /a;b/ 'a;b' \"a;b\"; scriptlet-1; scriptlet2 'arg0' arg1\\ something;",
            ),
        ).toMatchObject({
            type: 'ScriptletInjectionRuleBody',
            loc: {
                start: {
                    offset: 0,
                    line: 1,
                    column: 1,
                },
                end: {
                    offset: 82,
                    line: 1,
                    column: 83,
                },
            },
            children: [
                {
                    type: 'ParameterList',
                    loc: {
                        start: {
                            offset: 0,
                            line: 1,
                            column: 1,
                        },
                        end: {
                            offset: 33,
                            line: 1,
                            column: 34,
                        },
                    },
                    children: [
                        {
                            type: 'Parameter',
                            loc: {
                                start: {
                                    offset: 0,
                                    line: 1,
                                    column: 1,
                                },
                                end: {
                                    offset: 10,
                                    line: 1,
                                    column: 11,
                                },
                            },
                            value: 'scriptlet0',
                        },
                        {
                            type: 'Parameter',
                            loc: {
                                start: {
                                    offset: 11,
                                    line: 1,
                                    column: 12,
                                },
                                end: {
                                    offset: 15,
                                    line: 1,
                                    column: 16,
                                },
                            },
                            value: 'arg0',
                        },
                        {
                            type: 'Parameter',
                            loc: {
                                start: {
                                    offset: 16,
                                    line: 1,
                                    column: 17,
                                },
                                end: {
                                    offset: 21,
                                    line: 1,
                                    column: 22,
                                },
                            },
                            value: '/a;b/',
                        },
                        {
                            type: 'Parameter',
                            loc: {
                                start: {
                                    offset: 22,
                                    line: 1,
                                    column: 23,
                                },
                                end: {
                                    offset: 27,
                                    line: 1,
                                    column: 28,
                                },
                            },
                            value: "'a;b'",
                        },
                        {
                            type: 'Parameter',
                            loc: {
                                start: {
                                    offset: 28,
                                    line: 1,
                                    column: 29,
                                },
                                end: {
                                    offset: 33,
                                    line: 1,
                                    column: 34,
                                },
                            },
                            value: '"a;b"',
                        },
                    ],
                },
                {
                    type: 'ParameterList',
                    loc: {
                        start: {
                            offset: 35,
                            line: 1,
                            column: 36,
                        },
                        end: {
                            offset: 46,
                            line: 1,
                            column: 47,
                        },
                    },
                    children: [
                        {
                            type: 'Parameter',
                            loc: {
                                start: {
                                    offset: 35,
                                    line: 1,
                                    column: 36,
                                },
                                end: {
                                    offset: 46,
                                    line: 1,
                                    column: 47,
                                },
                            },
                            value: 'scriptlet-1',
                        },
                    ],
                },
                {
                    type: 'ParameterList',
                    loc: {
                        start: {
                            offset: 48,
                            line: 1,
                            column: 49,
                        },
                        end: {
                            offset: 81,
                            line: 1,
                            column: 82,
                        },
                    },
                    children: [
                        {
                            type: 'Parameter',
                            loc: {
                                start: {
                                    offset: 48,
                                    line: 1,
                                    column: 49,
                                },
                                end: {
                                    offset: 58,
                                    line: 1,
                                    column: 59,
                                },
                            },
                            value: 'scriptlet2',
                        },
                        {
                            type: 'Parameter',
                            loc: {
                                start: {
                                    offset: 59,
                                    line: 1,
                                    column: 60,
                                },
                                end: {
                                    offset: 65,
                                    line: 1,
                                    column: 66,
                                },
                            },
                            value: "'arg0'",
                        },
                        {
                            type: 'Parameter',
                            loc: {
                                start: {
                                    offset: 66,
                                    line: 1,
                                    column: 67,
                                },
                                end: {
                                    offset: 81,
                                    line: 1,
                                    column: 82,
                                },
                            },
                            value: 'arg1\\ something',
                        },
                    ],
                },
            ],
        });

        // Another complicated case
        expect(
            ScriptletInjectionBodyParser.parseAbpSnippetCall(
                // eslint-disable-next-line max-len
                'hide-if-matches-xpath \'.//*[@class="test-xpath-class"]\'; hide-if-matches-xpath \'.//div[@id="aaa"]//div[starts-with(@id,"aaa")][.//h1//span/text()="aaa"]\'; hide-if-matches-xpath \'.//div[@id="bbb"]//div[starts-with(@id,"bbb")][.//h1//span/text()="bbb"]\'',
            ),
        ).toMatchObject({
            type: 'ScriptletInjectionRuleBody',
            loc: {
                start: {
                    offset: 0,
                    line: 1,
                    column: 1,
                },
                end: {
                    offset: 251,
                    line: 1,
                    column: 252,
                },
            },
            children: [
                {
                    type: 'ParameterList',
                    loc: {
                        start: {
                            offset: 0,
                            line: 1,
                            column: 1,
                        },
                        end: {
                            offset: 55,
                            line: 1,
                            column: 56,
                        },
                    },
                    children: [
                        {
                            type: 'Parameter',
                            loc: {
                                start: {
                                    offset: 0,
                                    line: 1,
                                    column: 1,
                                },
                                end: {
                                    offset: 21,
                                    line: 1,
                                    column: 22,
                                },
                            },
                            value: 'hide-if-matches-xpath',
                        },
                        {
                            type: 'Parameter',
                            loc: {
                                start: {
                                    offset: 22,
                                    line: 1,
                                    column: 23,
                                },
                                end: {
                                    offset: 55,
                                    line: 1,
                                    column: 56,
                                },
                            },
                            value: "'.//*[@class=\"test-xpath-class\"]'",
                        },
                    ],
                },
                {
                    type: 'ParameterList',
                    loc: {
                        start: {
                            offset: 57,
                            line: 1,
                            column: 58,
                        },
                        end: {
                            offset: 153,
                            line: 1,
                            column: 154,
                        },
                    },
                    children: [
                        {
                            type: 'Parameter',
                            loc: {
                                start: {
                                    offset: 57,
                                    line: 1,
                                    column: 58,
                                },
                                end: {
                                    offset: 78,
                                    line: 1,
                                    column: 79,
                                },
                            },
                            value: 'hide-if-matches-xpath',
                        },
                        {
                            type: 'Parameter',
                            loc: {
                                start: {
                                    offset: 79,
                                    line: 1,
                                    column: 80,
                                },
                                end: {
                                    offset: 153,
                                    line: 1,
                                    column: 154,
                                },
                            },
                            value: "'.//div[@id=\"aaa\"]//div[starts-with(@id,\"aaa\")][.//h1//span/text()=\"aaa\"]'",
                        },
                    ],
                },
                {
                    type: 'ParameterList',
                    loc: {
                        start: {
                            offset: 155,
                            line: 1,
                            column: 156,
                        },
                        end: {
                            offset: 251,
                            line: 1,
                            column: 252,
                        },
                    },
                    children: [
                        {
                            type: 'Parameter',
                            loc: {
                                start: {
                                    offset: 155,
                                    line: 1,
                                    column: 156,
                                },
                                end: {
                                    offset: 176,
                                    line: 1,
                                    column: 177,
                                },
                            },
                            value: 'hide-if-matches-xpath',
                        },
                        {
                            type: 'Parameter',
                            loc: {
                                start: {
                                    offset: 177,
                                    line: 1,
                                    column: 178,
                                },
                                end: {
                                    offset: 251,
                                    line: 1,
                                    column: 252,
                                },
                            },
                            value: "'.//div[@id=\"bbb\"]//div[starts-with(@id,\"bbb\")][.//h1//span/text()=\"bbb\"]'",
                        },
                    ],
                },
            ],
        });

        // Complicated "real world" example
        // eslint-disable-next-line max-len
        // Source: https://github.com/abp-filters/abp-filters-anti-cv/blob/4474f3aafcdb87bb7dd4053f1950068f7e3906ef/fb_non-graph.txt#L2
        expect(
            ScriptletInjectionBodyParser.parseAbpSnippetCall(
                // eslint-disable-next-line max-len
                'race start; hide-if-contains-visible-text /[Sponsred]{9}|[Gesponrtd]{10}|[Sponrisé]{10}|[Comandité]{9}|[Publicda]{10}|[Sponsrwae]{12}|[Patrocind]{11}|[Sponsrizat]{13}/ \'div[role=feed] div[role=article]\' a[href="#"][role="link"]; hide-if-contains-visible-text /[Sponsred]{9}|[Gesponrtd]{10}|[Sponrisé]{10}|[Comandité]{9}|[Publicda]{10}|[Sponsrwae]{12}|[Patrocind]{11}|[Sponsrizat]{13}/ \'div[role=feed] div[role=article]\' a[href^="?__cft__"]; hide-if-contains-visible-text /[Sponsred]{9}|[Gesponrtd]{10}|[Sponrisé]{10}|[Comandité]{9}|[Publicda]{10}|[Sponsrwae]{12}|[Patrocind]{11}|[Sponsrizat]{13}/ \'div[role=feed] div[role=article]\' a[href="#"][role="link"]>span>span>b; hide-if-matches-xpath \'.//div[@role="feed"]//div[@role="article"]//a[@aria-label[.="Patrocinado" or .="Sponsa" or .="Bersponsor" or .="Commandité" or .="Ditaja" or .="Gesponsert" or .="Gesponsord" or .="Sponsrad" or .="Publicidad" or .="Sponsoreret" or .="Sponset" or .="Sponsored" or .="Sponsorisé" or .="Sponsorizat" or .="Sponsorizzato" or .="Sponsorlu" or .="Sponsorowane" or .="Реклама" or .="ממומן" or .="تمويل شوي" or .="دارای پشتیبانی مالی" or .="سپانسرڈ" or .="مُموَّل" or .="प्रायोजित" or .="সৌজন্যে" or .="ได้รับการสนับสนุน" or .="内容" or .="贊助" or .="Sponsoroitu" or .="May Sponsor" or .="Được tài trợ"]]/ancestor::div[@role="article"]\'; race stop;',
            ),
        ).toMatchObject({
            type: 'ScriptletInjectionRuleBody',
            loc: {
                start: {
                    offset: 0,
                    line: 1,
                    column: 1,
                },
                end: {
                    offset: 1329,
                    line: 1,
                    column: 1330,
                },
            },
            children: [
                {
                    type: 'ParameterList',
                    loc: {
                        start: {
                            offset: 0,
                            line: 1,
                            column: 1,
                        },
                        end: {
                            offset: 10,
                            line: 1,
                            column: 11,
                        },
                    },
                    children: [
                        {
                            type: 'Parameter',
                            loc: {
                                start: {
                                    offset: 0,
                                    line: 1,
                                    column: 1,
                                },
                                end: {
                                    offset: 4,
                                    line: 1,
                                    column: 5,
                                },
                            },
                            value: 'race',
                        },
                        {
                            type: 'Parameter',
                            loc: {
                                start: {
                                    offset: 5,
                                    line: 1,
                                    column: 6,
                                },
                                end: {
                                    offset: 10,
                                    line: 1,
                                    column: 11,
                                },
                            },
                            value: 'start',
                        },
                    ],
                },
                {
                    type: 'ParameterList',
                    loc: {
                        start: {
                            offset: 12,
                            line: 1,
                            column: 13,
                        },
                        end: {
                            offset: 227,
                            line: 1,
                            column: 228,
                        },
                    },
                    children: [
                        {
                            type: 'Parameter',
                            loc: {
                                start: {
                                    offset: 12,
                                    line: 1,
                                    column: 13,
                                },
                                end: {
                                    offset: 41,
                                    line: 1,
                                    column: 42,
                                },
                            },
                            value: 'hide-if-contains-visible-text',
                        },
                        {
                            type: 'Parameter',
                            loc: {
                                start: {
                                    offset: 42,
                                    line: 1,
                                    column: 43,
                                },
                                end: {
                                    offset: 167,
                                    line: 1,
                                    column: 168,
                                },
                            },
                            // eslint-disable-next-line max-len
                            value: '/[Sponsred]{9}|[Gesponrtd]{10}|[Sponrisé]{10}|[Comandité]{9}|[Publicda]{10}|[Sponsrwae]{12}|[Patrocind]{11}|[Sponsrizat]{13}/',
                        },
                        {
                            type: 'Parameter',
                            loc: {
                                start: {
                                    offset: 168,
                                    line: 1,
                                    column: 169,
                                },
                                end: {
                                    offset: 202,
                                    line: 1,
                                    column: 203,
                                },
                            },
                            value: "'div[role=feed] div[role=article]'",
                        },
                        {
                            type: 'Parameter',
                            loc: {
                                start: {
                                    offset: 203,
                                    line: 1,
                                    column: 204,
                                },
                                end: {
                                    offset: 227,
                                    line: 1,
                                    column: 228,
                                },
                            },
                            value: 'a[href="#"][role="link"]',
                        },
                    ],
                },
                {
                    type: 'ParameterList',
                    loc: {
                        start: {
                            offset: 229,
                            line: 1,
                            column: 230,
                        },
                        end: {
                            offset: 439,
                            line: 1,
                            column: 440,
                        },
                    },
                    children: [
                        {
                            type: 'Parameter',
                            loc: {
                                start: {
                                    offset: 229,
                                    line: 1,
                                    column: 230,
                                },
                                end: {
                                    offset: 258,
                                    line: 1,
                                    column: 259,
                                },
                            },
                            value: 'hide-if-contains-visible-text',
                        },
                        {
                            type: 'Parameter',
                            loc: {
                                start: {
                                    offset: 259,
                                    line: 1,
                                    column: 260,
                                },
                                end: {
                                    offset: 384,
                                    line: 1,
                                    column: 385,
                                },
                            },
                            // eslint-disable-next-line max-len
                            value: '/[Sponsred]{9}|[Gesponrtd]{10}|[Sponrisé]{10}|[Comandité]{9}|[Publicda]{10}|[Sponsrwae]{12}|[Patrocind]{11}|[Sponsrizat]{13}/',
                        },
                        {
                            type: 'Parameter',
                            loc: {
                                start: {
                                    offset: 385,
                                    line: 1,
                                    column: 386,
                                },
                                end: {
                                    offset: 419,
                                    line: 1,
                                    column: 420,
                                },
                            },
                            value: "'div[role=feed] div[role=article]'",
                        },
                        {
                            type: 'Parameter',
                            loc: {
                                start: {
                                    offset: 420,
                                    line: 1,
                                    column: 421,
                                },
                                end: {
                                    offset: 439,
                                    line: 1,
                                    column: 440,
                                },
                            },
                            value: 'a[href^="?__cft__"]',
                        },
                    ],
                },
                {
                    type: 'ParameterList',
                    loc: {
                        start: {
                            offset: 441,
                            line: 1,
                            column: 442,
                        },
                        end: {
                            offset: 668,
                            line: 1,
                            column: 669,
                        },
                    },
                    children: [
                        {
                            type: 'Parameter',
                            loc: {
                                start: {
                                    offset: 441,
                                    line: 1,
                                    column: 442,
                                },
                                end: {
                                    offset: 470,
                                    line: 1,
                                    column: 471,
                                },
                            },
                            value: 'hide-if-contains-visible-text',
                        },
                        {
                            type: 'Parameter',
                            loc: {
                                start: {
                                    offset: 471,
                                    line: 1,
                                    column: 472,
                                },
                                end: {
                                    offset: 596,
                                    line: 1,
                                    column: 597,
                                },
                            },
                            // eslint-disable-next-line max-len
                            value: '/[Sponsred]{9}|[Gesponrtd]{10}|[Sponrisé]{10}|[Comandité]{9}|[Publicda]{10}|[Sponsrwae]{12}|[Patrocind]{11}|[Sponsrizat]{13}/',
                        },
                        {
                            type: 'Parameter',
                            loc: {
                                start: {
                                    offset: 597,
                                    line: 1,
                                    column: 598,
                                },
                                end: {
                                    offset: 631,
                                    line: 1,
                                    column: 632,
                                },
                            },
                            value: "'div[role=feed] div[role=article]'",
                        },
                        {
                            type: 'Parameter',
                            loc: {
                                start: {
                                    offset: 632,
                                    line: 1,
                                    column: 633,
                                },
                                end: {
                                    offset: 668,
                                    line: 1,
                                    column: 669,
                                },
                            },
                            value: 'a[href="#"][role="link"]>span>span>b',
                        },
                    ],
                },
                {
                    type: 'ParameterList',
                    loc: {
                        start: {
                            offset: 670,
                            line: 1,
                            column: 671,
                        },
                        end: {
                            offset: 1317,
                            line: 1,
                            column: 1318,
                        },
                    },
                    children: [
                        {
                            type: 'Parameter',
                            loc: {
                                start: {
                                    offset: 670,
                                    line: 1,
                                    column: 671,
                                },
                                end: {
                                    offset: 691,
                                    line: 1,
                                    column: 692,
                                },
                            },
                            value: 'hide-if-matches-xpath',
                        },
                        {
                            type: 'Parameter',
                            loc: {
                                start: {
                                    offset: 692,
                                    line: 1,
                                    column: 693,
                                },
                                end: {
                                    offset: 1317,
                                    line: 1,
                                    column: 1318,
                                },
                            },
                            // eslint-disable-next-line max-len
                            value: '\'.//div[@role="feed"]//div[@role="article"]//a[@aria-label[.="Patrocinado" or .="Sponsa" or .="Bersponsor" or .="Commandité" or .="Ditaja" or .="Gesponsert" or .="Gesponsord" or .="Sponsrad" or .="Publicidad" or .="Sponsoreret" or .="Sponset" or .="Sponsored" or .="Sponsorisé" or .="Sponsorizat" or .="Sponsorizzato" or .="Sponsorlu" or .="Sponsorowane" or .="Реклама" or .="ממומן" or .="تمويل شوي" or .="دارای پشتیبانی مالی" or .="سپانسرڈ" or .="مُموَّل" or .="प्रायोजित" or .="সৌজন্যে" or .="ได้รับการสนับสนุน" or .="内容" or .="贊助" or .="Sponsoroitu" or .="May Sponsor" or .="Được tài trợ"]]/ancestor::div[@role="article"]\'',
                        },
                    ],
                },
                {
                    type: 'ParameterList',
                    loc: {
                        start: {
                            offset: 1319,
                            line: 1,
                            column: 1320,
                        },
                        end: {
                            offset: 1328,
                            line: 1,
                            column: 1329,
                        },
                    },
                    children: [
                        {
                            type: 'Parameter',
                            loc: {
                                start: {
                                    offset: 1319,
                                    line: 1,
                                    column: 1320,
                                },
                                end: {
                                    offset: 1323,
                                    line: 1,
                                    column: 1324,
                                },
                            },
                            value: 'race',
                        },
                        {
                            type: 'Parameter',
                            loc: {
                                start: {
                                    offset: 1324,
                                    line: 1,
                                    column: 1325,
                                },
                                end: {
                                    offset: 1328,
                                    line: 1,
                                    column: 1329,
                                },
                            },
                            value: 'stop',
                        },
                    ],
                },
            ],
        });

        // Empty case
        expect(() => ScriptletInjectionBodyParser.parseAbpSnippetCall(EMPTY)).toThrowError(
            'Invalid ABP snippet call, no scriptlets specified at all',
        );

        expect(() => ScriptletInjectionBodyParser.parseAbpSnippetCall(SPACE)).toThrowError(
            'Invalid ABP snippet call, no scriptlets specified at all',
        );
    });

    test('parse', () => {
        // ADG & uBO
        expect(ScriptletInjectionBodyParser.parse("js(scriptlet0, arg0, /a;b/, 'a;b', \"a;b\")")).toMatchObject({
            type: 'ScriptletInjectionRuleBody',
            loc: {
                start: {
                    offset: 0,
                    line: 1,
                    column: 1,
                },
                end: {
                    offset: 41,
                    line: 1,
                    column: 42,
                },
            },
            children: [
                {
                    type: 'ParameterList',
                    loc: {
                        start: {
                            offset: 3,
                            line: 1,
                            column: 4,
                        },
                        end: {
                            offset: 40,
                            line: 1,
                            column: 41,
                        },
                    },
                    children: [
                        {
                            type: 'Parameter',
                            loc: {
                                start: {
                                    offset: 3,
                                    line: 1,
                                    column: 4,
                                },
                                end: {
                                    offset: 13,
                                    line: 1,
                                    column: 14,
                                },
                            },
                            value: 'scriptlet0',
                        },
                        {
                            type: 'Parameter',
                            loc: {
                                start: {
                                    offset: 15,
                                    line: 1,
                                    column: 16,
                                },
                                end: {
                                    offset: 19,
                                    line: 1,
                                    column: 20,
                                },
                            },
                            value: 'arg0',
                        },
                        {
                            type: 'Parameter',
                            loc: {
                                start: {
                                    offset: 21,
                                    line: 1,
                                    column: 22,
                                },
                                end: {
                                    offset: 26,
                                    line: 1,
                                    column: 27,
                                },
                            },
                            value: '/a;b/',
                        },
                        {
                            type: 'Parameter',
                            loc: {
                                start: {
                                    offset: 28,
                                    line: 1,
                                    column: 29,
                                },
                                end: {
                                    offset: 33,
                                    line: 1,
                                    column: 34,
                                },
                            },
                            value: "'a;b'",
                        },
                        {
                            type: 'Parameter',
                            loc: {
                                start: {
                                    offset: 35,
                                    line: 1,
                                    column: 36,
                                },
                                end: {
                                    offset: 40,
                                    line: 1,
                                    column: 41,
                                },
                            },
                            value: '"a;b"',
                        },
                    ],
                },
            ],
        });

        // ABP
        expect(
            ScriptletInjectionBodyParser.parse(
                "scriptlet0 arg0 /a;b/ 'a;b' \"a;b\"; scriptlet-1; scriptlet2 'arg0' arg1\\ something;",
            ),
        ).toMatchObject({
            type: 'ScriptletInjectionRuleBody',
            loc: {
                start: {
                    offset: 0,
                    line: 1,
                    column: 1,
                },
                end: {
                    offset: 82,
                    line: 1,
                    column: 83,
                },
            },
            children: [
                {
                    type: 'ParameterList',
                    loc: {
                        start: {
                            offset: 0,
                            line: 1,
                            column: 1,
                        },
                        end: {
                            offset: 33,
                            line: 1,
                            column: 34,
                        },
                    },
                    children: [
                        {
                            type: 'Parameter',
                            loc: {
                                start: {
                                    offset: 0,
                                    line: 1,
                                    column: 1,
                                },
                                end: {
                                    offset: 10,
                                    line: 1,
                                    column: 11,
                                },
                            },
                            value: 'scriptlet0',
                        },
                        {
                            type: 'Parameter',
                            loc: {
                                start: {
                                    offset: 11,
                                    line: 1,
                                    column: 12,
                                },
                                end: {
                                    offset: 15,
                                    line: 1,
                                    column: 16,
                                },
                            },
                            value: 'arg0',
                        },
                        {
                            type: 'Parameter',
                            loc: {
                                start: {
                                    offset: 16,
                                    line: 1,
                                    column: 17,
                                },
                                end: {
                                    offset: 21,
                                    line: 1,
                                    column: 22,
                                },
                            },
                            value: '/a;b/',
                        },
                        {
                            type: 'Parameter',
                            loc: {
                                start: {
                                    offset: 22,
                                    line: 1,
                                    column: 23,
                                },
                                end: {
                                    offset: 27,
                                    line: 1,
                                    column: 28,
                                },
                            },
                            value: "'a;b'",
                        },
                        {
                            type: 'Parameter',
                            loc: {
                                start: {
                                    offset: 28,
                                    line: 1,
                                    column: 29,
                                },
                                end: {
                                    offset: 33,
                                    line: 1,
                                    column: 34,
                                },
                            },
                            value: '"a;b"',
                        },
                    ],
                },
                {
                    type: 'ParameterList',
                    loc: {
                        start: {
                            offset: 35,
                            line: 1,
                            column: 36,
                        },
                        end: {
                            offset: 46,
                            line: 1,
                            column: 47,
                        },
                    },
                    children: [
                        {
                            type: 'Parameter',
                            loc: {
                                start: {
                                    offset: 35,
                                    line: 1,
                                    column: 36,
                                },
                                end: {
                                    offset: 46,
                                    line: 1,
                                    column: 47,
                                },
                            },
                            value: 'scriptlet-1',
                        },
                    ],
                },
                {
                    type: 'ParameterList',
                    loc: {
                        start: {
                            offset: 48,
                            line: 1,
                            column: 49,
                        },
                        end: {
                            offset: 81,
                            line: 1,
                            column: 82,
                        },
                    },
                    children: [
                        {
                            type: 'Parameter',
                            loc: {
                                start: {
                                    offset: 48,
                                    line: 1,
                                    column: 49,
                                },
                                end: {
                                    offset: 58,
                                    line: 1,
                                    column: 59,
                                },
                            },
                            value: 'scriptlet2',
                        },
                        {
                            type: 'Parameter',
                            loc: {
                                start: {
                                    offset: 59,
                                    line: 1,
                                    column: 60,
                                },
                                end: {
                                    offset: 65,
                                    line: 1,
                                    column: 66,
                                },
                            },
                            value: "'arg0'",
                        },
                        {
                            type: 'Parameter',
                            loc: {
                                start: {
                                    offset: 66,
                                    line: 1,
                                    column: 67,
                                },
                                end: {
                                    offset: 81,
                                    line: 1,
                                    column: 82,
                                },
                            },
                            value: 'arg1\\ something',
                        },
                    ],
                },
            ],
        });
    });

    test('generate', () => {
        const parseAndGenerate = (raw: string, syntax: AdblockSyntax) => {
            const ast = ScriptletInjectionBodyParser.parse(raw);

            if (ast) {
                return ScriptletInjectionBodyParser.generate(ast, syntax);
            }

            return null;
        };

        // Invalid
        expect(
            () => parseAndGenerate(
                // eslint-disable-next-line max-len
                'race start; hide-if-contains-visible-text /[Sponsred]{9}|[Gesponrtd]{10}|[Sponrisé]{10}|[Comandité]{9}|[Publicda]{10}|[Sponsrwae]{12}|[Patrocind]{11}|[Sponsrizat]{13}/ \'div[role=feed] div[role=article]\' a[href="#"][role="link"]; hide-if-contains-visible-text /[Sponsred]{9}|[Gesponrtd]{10}|[Sponrisé]{10}|[Comandité]{9}|[Publicda]{10}|[Sponsrwae]{12}|[Patrocind]{11}|[Sponsrizat]{13}/ \'div[role=feed] div[role=article]\' a[href^="?__cft__"]; hide-if-contains-visible-text /[Sponsred]{9}|[Gesponrtd]{10}|[Sponrisé]{10}|[Comandité]{9}|[Publicda]{10}|[Sponsrwae]{12}|[Patrocind]{11}|[Sponsrizat]{13}/ \'div[role=feed] div[role=article]\' a[href="#"][role="link"]>span>span>b; hide-if-matches-xpath \'.//div[@role="feed"]//div[@role="article"]//a[@aria-label[.="Patrocinado" or .="Sponsa" or .="Bersponsor" or .="Commandité" or .="Ditaja" or .="Gesponsert" or .="Gesponsord" or .="Sponsrad" or .="Publicidad" or .="Sponsoreret" or .="Sponset" or .="Sponsored" or .="Sponsorisé" or .="Sponsorizat" or .="Sponsorizzato" or .="Sponsorlu" or .="Sponsorowane" or .="Реклама" or .="ממומן" or .="تمويل شوي" or .="دارای پشتیبانی مالی" or .="سپانسرڈ" or .="مُموَّل" or .="प्रायोजित" or .="সৌজন্যে" or .="ได้รับการสนับสนุน" or .="内容" or .="贊助" or .="Sponsoroitu" or .="May Sponsor" or .="Được tài trợ"]]/ancestor::div[@role="article"]\'; race stop;',
                AdblockSyntax.Adg,
            ),
        ).toThrowError(
            'AdGuard and uBlock syntaxes don\'t support multiple scriptlet calls in one rule',
        );

        expect(
            () => parseAndGenerate(
                // eslint-disable-next-line max-len
                'race start; hide-if-contains-visible-text /[Sponsred]{9}|[Gesponrtd]{10}|[Sponrisé]{10}|[Comandité]{9}|[Publicda]{10}|[Sponsrwae]{12}|[Patrocind]{11}|[Sponsrizat]{13}/ \'div[role=feed] div[role=article]\' a[href="#"][role="link"]; hide-if-contains-visible-text /[Sponsred]{9}|[Gesponrtd]{10}|[Sponrisé]{10}|[Comandité]{9}|[Publicda]{10}|[Sponsrwae]{12}|[Patrocind]{11}|[Sponsrizat]{13}/ \'div[role=feed] div[role=article]\' a[href^="?__cft__"]; hide-if-contains-visible-text /[Sponsred]{9}|[Gesponrtd]{10}|[Sponrisé]{10}|[Comandité]{9}|[Publicda]{10}|[Sponsrwae]{12}|[Patrocind]{11}|[Sponsrizat]{13}/ \'div[role=feed] div[role=article]\' a[href="#"][role="link"]>span>span>b; hide-if-matches-xpath \'.//div[@role="feed"]//div[@role="article"]//a[@aria-label[.="Patrocinado" or .="Sponsa" or .="Bersponsor" or .="Commandité" or .="Ditaja" or .="Gesponsert" or .="Gesponsord" or .="Sponsrad" or .="Publicidad" or .="Sponsoreret" or .="Sponset" or .="Sponsored" or .="Sponsorisé" or .="Sponsorizat" or .="Sponsorizzato" or .="Sponsorlu" or .="Sponsorowane" or .="Реклама" or .="ממומן" or .="تمويل شوي" or .="دارای پشتیبانی مالی" or .="سپانسرڈ" or .="مُموَّل" or .="प्रायोजित" or .="সৌজন্যে" or .="ได้รับการสนับสนุน" or .="内容" or .="贊助" or .="Sponsoroitu" or .="May Sponsor" or .="Được tài trợ"]]/ancestor::div[@role="article"]\'; race stop;',
                AdblockSyntax.Ubo,
            ),
        ).toThrowError(
            'AdGuard and uBlock syntaxes don\'t support multiple scriptlet calls in one rule',
        );

        expect(
            () => ScriptletInjectionBodyParser.generate(
                {
                    type: 'ScriptletInjectionRuleBody',
                    children: [],
                },
                AdblockSyntax.Adg,
            ),
        ).toThrowError(
            'Invalid AST, no scriptlet calls specified',
        );

        expect(
            () => ScriptletInjectionBodyParser.generate(
                {
                    type: 'ScriptletInjectionRuleBody',
                    children: [
                        {
                            type: 'ParameterList',
                            children: [],
                        },
                    ],
                },
                AdblockSyntax.Adg,
            ),
        ).toThrowError(
            'Scriptlet name is not specified',
        );

        expect(
            () => ScriptletInjectionBodyParser.generate(
                {
                    type: 'ScriptletInjectionRuleBody',
                    children: [
                        {
                            type: 'ParameterList',
                            children: [],
                        },
                    ],
                },
                AdblockSyntax.Ubo,
            ),
        ).toThrowError(
            'Scriptlet name is not specified',
        );

        expect(
            () => ScriptletInjectionBodyParser.generate(
                {
                    type: 'ScriptletInjectionRuleBody',
                    children: [
                        {
                            type: 'ParameterList',
                            children: [],
                        },
                    ],
                },
                AdblockSyntax.Abp,
            ),
        ).toThrowError(
            'Scriptlet name is not specified',
        );

        expect(
            parseAndGenerate(
                "js(scriptlet0, arg0, /a;b/, 'a;b', \"a;b\")",
                AdblockSyntax.Ubo,
            ),
        ).toEqual(
            "js(scriptlet0, arg0, /a;b/, 'a;b', \"a;b\")",
        );

        expect(
            parseAndGenerate(
                "//scriptlet(scriptlet0, arg0, /a;b/, 'a;b', \"a;b\")",
                AdblockSyntax.Adg,
            ),
        ).toEqual(
            "//scriptlet(scriptlet0, arg0, /a;b/, 'a;b', \"a;b\")",
        );

        expect(
            parseAndGenerate(
                "scriptlet0 arg0 /a;b/ 'a;b' \"a;b\"; scriptlet-1; scriptlet2 'arg0' arg1\\ something;",
                AdblockSyntax.Abp,
            ),
        ).toEqual(
            // ; disappear from the end of the line
            "scriptlet0 arg0 /a;b/ 'a;b' \"a;b\"; scriptlet-1; scriptlet2 'arg0' arg1\\ something",
        );

        expect(
            parseAndGenerate(
                'scriptlet0 arg0 arg1; scriptlet1; scriptlet2 arg0',
                AdblockSyntax.Abp,
            ),
        ).toEqual(
            'scriptlet0 arg0 arg1; scriptlet1; scriptlet2 arg0',
        );

        // Complicated "real world" example
        // eslint-disable-next-line max-len
        // Source: https://github.com/abp-filters/abp-filters-anti-cv/blob/4474f3aafcdb87bb7dd4053f1950068f7e3906ef/fb_non-graph.txt#L2
        expect(
            parseAndGenerate(
                // eslint-disable-next-line max-len
                'race start; hide-if-contains-visible-text /[Sponsred]{9}|[Gesponrtd]{10}|[Sponrisé]{10}|[Comandité]{9}|[Publicda]{10}|[Sponsrwae]{12}|[Patrocind]{11}|[Sponsrizat]{13}/ \'div[role=feed] div[role=article]\' a[href="#"][role="link"]; hide-if-contains-visible-text /[Sponsred]{9}|[Gesponrtd]{10}|[Sponrisé]{10}|[Comandité]{9}|[Publicda]{10}|[Sponsrwae]{12}|[Patrocind]{11}|[Sponsrizat]{13}/ \'div[role=feed] div[role=article]\' a[href^="?__cft__"]; hide-if-contains-visible-text /[Sponsred]{9}|[Gesponrtd]{10}|[Sponrisé]{10}|[Comandité]{9}|[Publicda]{10}|[Sponsrwae]{12}|[Patrocind]{11}|[Sponsrizat]{13}/ \'div[role=feed] div[role=article]\' a[href="#"][role="link"]>span>span>b; hide-if-matches-xpath \'.//div[@role="feed"]//div[@role="article"]//a[@aria-label[.="Patrocinado" or .="Sponsa" or .="Bersponsor" or .="Commandité" or .="Ditaja" or .="Gesponsert" or .="Gesponsord" or .="Sponsrad" or .="Publicidad" or .="Sponsoreret" or .="Sponset" or .="Sponsored" or .="Sponsorisé" or .="Sponsorizat" or .="Sponsorizzato" or .="Sponsorlu" or .="Sponsorowane" or .="Реклама" or .="ממומן" or .="تمويل شوي" or .="دارای پشتیبانی مالی" or .="سپانسرڈ" or .="مُموَّل" or .="प्रायोजित" or .="সৌজন্যে" or .="ได้รับการสนับสนุน" or .="内容" or .="贊助" or .="Sponsoroitu" or .="May Sponsor" or .="Được tài trợ"]]/ancestor::div[@role="article"]\'; race stop;',
                AdblockSyntax.Abp,
            ),
        ).toEqual(
            // ; disappear from the end of the line
            // eslint-disable-next-line max-len
            'race start; hide-if-contains-visible-text /[Sponsred]{9}|[Gesponrtd]{10}|[Sponrisé]{10}|[Comandité]{9}|[Publicda]{10}|[Sponsrwae]{12}|[Patrocind]{11}|[Sponsrizat]{13}/ \'div[role=feed] div[role=article]\' a[href="#"][role="link"]; hide-if-contains-visible-text /[Sponsred]{9}|[Gesponrtd]{10}|[Sponrisé]{10}|[Comandité]{9}|[Publicda]{10}|[Sponsrwae]{12}|[Patrocind]{11}|[Sponsrizat]{13}/ \'div[role=feed] div[role=article]\' a[href^="?__cft__"]; hide-if-contains-visible-text /[Sponsred]{9}|[Gesponrtd]{10}|[Sponrisé]{10}|[Comandité]{9}|[Publicda]{10}|[Sponsrwae]{12}|[Patrocind]{11}|[Sponsrizat]{13}/ \'div[role=feed] div[role=article]\' a[href="#"][role="link"]>span>span>b; hide-if-matches-xpath \'.//div[@role="feed"]//div[@role="article"]//a[@aria-label[.="Patrocinado" or .="Sponsa" or .="Bersponsor" or .="Commandité" or .="Ditaja" or .="Gesponsert" or .="Gesponsord" or .="Sponsrad" or .="Publicidad" or .="Sponsoreret" or .="Sponset" or .="Sponsored" or .="Sponsorisé" or .="Sponsorizat" or .="Sponsorizzato" or .="Sponsorlu" or .="Sponsorowane" or .="Реклама" or .="ממומן" or .="تمويل شوي" or .="دارای پشتیبانی مالی" or .="سپانسرڈ" or .="مُموَّل" or .="प्रायोजित" or .="সৌজন্যে" or .="ได้รับการสนับสนุน" or .="内容" or .="贊助" or .="Sponsoroitu" or .="May Sponsor" or .="Được tài trợ"]]/ancestor::div[@role="article"]\'; race stop',
        );
    });
});
