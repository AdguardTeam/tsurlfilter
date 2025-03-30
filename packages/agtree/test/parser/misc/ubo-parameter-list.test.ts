import {
    describe,
    test,
    expect,
    vi,
} from 'vitest';

import { COMMA } from '../../../src/utils/constants';
import { NodeExpectContext, type NodeExpectFn } from '../../helpers/node-utils';
import { AdblockSyntaxError } from '../../../src/errors/adblock-syntax-error';
import { UboParameterListParser } from '../../../src/parser/misc/ubo-parameter-list-parser';
import { defaultParserOptions } from '../../../src/parser/options';
import { type ParameterList } from '../../../src/nodes';

describe('UboParameterListParser', () => {
    // valid cases are tested in `../cosmetic/body/ubo-scriptlet.test.ts`

    describe('UboParameterListParser.parse - invalid cases when requireQuotes enabled', () => {
        test.each<{ actual: string; expected: NodeExpectFn<AdblockSyntaxError> }>([
            {
                actual: String.raw`abc`,
                //                 ~~~
                expected: (context: NodeExpectContext): AdblockSyntaxError => {
                    return new AdblockSyntaxError(
                        "Expected quote, got: 'a'",
                        ...context.toTuple(context.getFullRange()),
                    );
                },
            },
            {
                actual: String.raw`'abc`,
                //                  ~~~
                expected: (context: NodeExpectContext): AdblockSyntaxError => {
                    return new AdblockSyntaxError(
                        'Expected closing quote, got end of string',
                        ...context.toTuple(context.getFullRange()),
                    );
                },
            },
            {
                actual: String.raw`'abc,`,
                //                  ~~~~
                expected: (context: NodeExpectContext): AdblockSyntaxError => {
                    return new AdblockSyntaxError(
                        'Expected closing quote, got end of string',
                        ...context.toTuple(context.getFullRange()),
                    );
                },
            },
            {
                actual: String.raw`'abc', 'aaa`,
                //                        ~~~~
                expected: (context: NodeExpectContext): AdblockSyntaxError => {
                    return new AdblockSyntaxError(
                        'Expected closing quote, got end of string',
                        ...context.toTuple(context.getRangeFor(String.raw`'aaa`)),
                    );
                },
            },
            {
                actual: String.raw`'abc', bbb`,
                //                        ~~~
                expected: (context: NodeExpectContext): AdblockSyntaxError => {
                    return new AdblockSyntaxError(
                        "Expected quote, got: 'b'",
                        ...context.toTuple(context.getRangeFor(String.raw`bbb`)),
                    );
                },
            },
            {
                actual: String.raw`'abc' 'bbb'`,
                //                       ~~~~~
                expected: (context: NodeExpectContext): AdblockSyntaxError => {
                    return new AdblockSyntaxError(
                        "Expected separator, got: '''",
                        ...context.toTuple(context.getRangeFor(String.raw`'bbb'`)),
                    );
                },
            },
        ])("should throw on input: '$actual'", ({ actual, expected: expectedFn }) => {
            const fn = vi.fn(() => UboParameterListParser.parse(actual, defaultParserOptions, 0, COMMA, true));

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

    describe('UboParameterListParser.parse - valid cases when requireQuotes disabled', () => {
        test.each<{ actual: string; expected: ParameterList }>([
            {
                actual: String.raw`abc`,
                expected: {
                    type: 'ParameterList',
                    start: 0,
                    end: 3,
                    children: [
                        {
                            type: 'Value',
                            start: 0,
                            end: 3,
                            value: String.raw`abc`,
                        },
                    ],
                },
            },
            {
                actual: String.raw`abc, cba`,
                expected: {
                    type: 'ParameterList',
                    start: 0,
                    end: 8,
                    children: [
                        {
                            type: 'Value',
                            start: 0,
                            end: 3,
                            value: String.raw`abc`,
                        },
                        {
                            type: 'Value',
                            start: 5,
                            end: 8,
                            value: String.raw`cba`,
                        },
                    ],
                },
            },
            {
                actual: String.raw`abc, cba,`,
                expected: {
                    type: 'ParameterList',
                    start: 0,
                    end: 9,
                    children: [
                        {
                            type: 'Value',
                            start: 0,
                            end: 3,
                            value: String.raw`abc`,
                        },
                        {
                            type: 'Value',
                            start: 5,
                            end: 8,
                            value: String.raw`cba`,
                        },
                        null,
                    ],
                },
            },
            {
                actual: String.raw`abc, cba,  `,
                expected: {
                    type: 'ParameterList',
                    start: 0,
                    end: 11,
                    children: [
                        {
                            type: 'Value',
                            start: 0,
                            end: 3,
                            value: String.raw`abc`,
                        },
                        {
                            type: 'Value',
                            start: 5,
                            end: 8,
                            value: String.raw`cba`,
                        },
                        null,
                    ],
                },
            },
            {
                actual: String.raw`abc, , cba,`,
                expected: {
                    type: 'ParameterList',
                    start: 0,
                    end: 11,
                    children: [
                        {
                            type: 'Value',
                            start: 0,
                            end: 3,
                            value: String.raw`abc`,
                        },
                        null,
                        {
                            type: 'Value',
                            start: 7,
                            end: 10,
                            value: String.raw`cba`,
                        },
                        null,
                    ],
                },
            },
            {
                actual: String.raw`'abc   `,
                expected: {
                    type: 'ParameterList',
                    start: 0,
                    end: 7,
                    children: [
                        {
                            type: 'Value',
                            start: 0,
                            end: 4,
                            value: String.raw`'abc`,
                        },
                    ],
                },
            },
            {
                actual: String.raw`abc, ').cba='1'`,
                expected: {
                    type: 'ParameterList',
                    start: 0,
                    end: 15,
                    children: [
                        {
                            type: 'Value',
                            start: 0,
                            end: 3,
                            value: String.raw`abc`,
                        },
                        {
                            type: 'Value',
                            start: 5,
                            end: 15,
                            value: String.raw`').cba='1'`,
                        },
                    ],
                },
            },
            {
                actual: String.raw`abc, ').cba, '1'`,
                expected: {
                    type: 'ParameterList',
                    start: 0,
                    end: 16,
                    children: [
                        {
                            type: 'Value',
                            start: 0,
                            end: 3,
                            value: String.raw`abc`,
                        },
                        {
                            type: 'Value',
                            start: 5,
                            end: 11,
                            value: String.raw`').cba`,
                        },
                        {
                            type: 'Value',
                            start: 13,
                            end: 16,
                            value: String.raw`'1'`,
                        },
                    ],
                },
            },
            {
                actual: String.raw`abc, ').cba='1', cba`,
                expected: {
                    type: 'ParameterList',
                    start: 0,
                    end: 20,
                    children: [
                        {
                            type: 'Value',
                            start: 0,
                            end: 3,
                            value: String.raw`abc`,
                        },
                        {
                            type: 'Value',
                            start: 5,
                            end: 15,
                            value: String.raw`').cba='1'`,
                        },
                        {
                            type: 'Value',
                            start: 17,
                            end: 20,
                            value: String.raw`cba`,
                        },
                    ],
                },
            },
        ])("should parse correctly on input '$actual'", ({ actual, expected }) => {
            const result = UboParameterListParser.parse(actual, defaultParserOptions, 0, COMMA, false);

            expect(result).toMatchObject(expected);
        });
    });
});
