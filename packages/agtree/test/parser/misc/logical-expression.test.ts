import { describe, test, expect } from 'vitest';

import { type AnyExpressionNode } from '../../../src/nodes/index.js';
import { LogicalExpressionParser } from '../../../src/parser/misc/logical-expression-parser.js';
import { LogicalExpressionGenerator } from '../../../src/generator/misc/logical-expression-generator.js';
import { LogicalExpressionSerializer } from '../../../src/serializer/misc/logical-expression-serializer.js';
import { LogicalExpressionDeserializer } from '../../../src/deserializer/misc/logical-expression-deserializer.js';

describe('LogicalExpressionParser', () => {
    // TODO: Refactor to test.each
    test('parse', () => {
        // Wrong operator usage
        expect(() => LogicalExpressionParser.parse('||')).toThrow();
        expect(() => LogicalExpressionParser.parse('&&')).toThrow();
        expect(() => LogicalExpressionParser.parse('||&&')).toThrow();
        expect(() => LogicalExpressionParser.parse('|| &&')).toThrow();
        expect(() => LogicalExpressionParser.parse('&&||')).toThrow();
        expect(() => LogicalExpressionParser.parse('&& ||')).toThrow();
        expect(() => LogicalExpressionParser.parse('a||')).toThrow();
        expect(() => LogicalExpressionParser.parse('a&&')).toThrow();
        expect(() => LogicalExpressionParser.parse('a ||')).toThrow();
        expect(() => LogicalExpressionParser.parse('a &&')).toThrow();
        expect(() => LogicalExpressionParser.parse('a|||b')).toThrow();
        expect(() => LogicalExpressionParser.parse('a&&&b')).toThrow();
        expect(() => LogicalExpressionParser.parse('a||&&b')).toThrow();
        expect(() => LogicalExpressionParser.parse('a||b&&')).toThrow();

        // Wrong parenthesis usage
        expect(() => LogicalExpressionParser.parse('(a')).toThrow();
        expect(() => LogicalExpressionParser.parse('a)')).toThrow();
        expect(() => LogicalExpressionParser.parse('((a)')).toThrow();
        expect(() => LogicalExpressionParser.parse('(a))')).toThrow();
        expect(() => LogicalExpressionParser.parse('(a||b&&c')).toThrow();

        // Invalid characters in variable names
        expect(() => LogicalExpressionParser.parse('_a && b')).toThrow();
        expect(() => LogicalExpressionParser.parse('1a && b')).toThrow();
        expect(() => LogicalExpressionParser.parse('á')).toThrow();
        expect(() => LogicalExpressionParser.parse('aaa || bb$b')).toThrow();

        // Valid expressions
        expect(LogicalExpressionParser.parse('a')).toMatchObject({
            type: 'Variable',
            start: 0,
            end: 1,
            name: 'a',
        });

        expect(LogicalExpressionParser.parse('!a')).toMatchObject({
            type: 'Operator',
            start: 0,
            end: 2,
            operator: '!',
            left: {
                type: 'Variable',
                start: 1,
                end: 2,
                name: 'a',
            },
        });

        expect(LogicalExpressionParser.parse('!!a')).toMatchObject({
            type: 'Operator',
            start: 0,
            end: 3,
            operator: '!',
            left: {
                type: 'Operator',
                start: 1,
                end: 3,
                operator: '!',
                left: {
                    type: 'Variable',
                    start: 2,
                    end: 3,
                    name: 'a',
                },
            },
        });

        expect(LogicalExpressionParser.parse('!(!a)')).toMatchObject({
            type: 'Operator',
            start: 0,
            end: 4,
            operator: '!',
            left: {
                type: 'Parenthesis',
                start: 2,
                end: 4,
                expression: {
                    type: 'Operator',
                    start: 2,
                    end: 4,
                    operator: '!',
                    left: {
                        type: 'Variable',
                        start: 3,
                        end: 4,
                        name: 'a',
                    },
                },
            },
        });

        expect(LogicalExpressionParser.parse('a||b')).toMatchObject({
            type: 'Operator',
            start: 0,
            end: 4,
            operator: '||',
            left: {
                type: 'Variable',
                start: 0,
                end: 1,
                name: 'a',
            },
            right: {
                type: 'Variable',
                start: 3,
                end: 4,
                name: 'b',
            },
        });

        expect(LogicalExpressionParser.parse('a || b')).toMatchObject({
            type: 'Operator',
            start: 0,
            end: 6,
            operator: '||',
            left: {
                type: 'Variable',
                start: 0,
                end: 1,
                name: 'a',
            },
            right: {
                type: 'Variable',
                start: 5,
                end: 6,
                name: 'b',
            },
        });

        expect(LogicalExpressionParser.parse('(a)')).toMatchObject({
            type: 'Parenthesis',
            start: 1,
            end: 2,
            expression: {
                type: 'Variable',
                start: 1,
                end: 2,
                name: 'a',
            },
        });

        expect(LogicalExpressionParser.parse('(a||b)')).toMatchObject({
            type: 'Parenthesis',
            start: 1,
            end: 5,
            expression: {
                type: 'Operator',
                start: 1,
                end: 5,
                operator: '||',
                left: {
                    type: 'Variable',
                    start: 1,
                    end: 2,
                    name: 'a',
                },
                right: {
                    type: 'Variable',
                    start: 4,
                    end: 5,
                    name: 'b',
                },
            },
        });

        expect(LogicalExpressionParser.parse('((a) && (!(b)))')).toMatchObject({
            type: 'Parenthesis',
            start: 2,
            end: 12,
            expression: {
                type: 'Operator',
                start: 2,
                end: 12,
                operator: '&&',
                left: {
                    type: 'Parenthesis',
                    start: 2,
                    end: 3,
                    expression: {
                        type: 'Variable',
                        start: 2,
                        end: 3,
                        name: 'a',
                    },
                },
                right: {
                    type: 'Parenthesis',
                    start: 9,
                    end: 12,
                    expression: {
                        type: 'Operator',
                        start: 9,
                        end: 12,
                        operator: '!',
                        left: {
                            type: 'Parenthesis',
                            start: 11,
                            end: 12,
                            expression: {
                                type: 'Variable',
                                start: 11,
                                end: 12,
                                name: 'b',
                            },
                        },
                    },
                },
            },
        });

        // Complex expression
        expect(
            LogicalExpressionParser.parse(
                // eslint-disable-next-line max-len
                '(adguard && !adguard_ext_safari) && (adguard_ext_android || (adguard_ext_chromium && (!adguard_ext_firefox)))',
            ),
        ).toMatchObject({
            type: 'Operator',
            start: 1,
            end: 106,
            operator: '&&',
            left: {
                type: 'Parenthesis',
                start: 1,
                end: 31,
                expression: {
                    type: 'Operator',
                    start: 1,
                    end: 31,
                    operator: '&&',
                    left: {
                        type: 'Variable',
                        start: 1,
                        end: 8,
                        name: 'adguard',
                    },
                    right: {
                        type: 'Operator',
                        start: 12,
                        end: 31,
                        operator: '!',
                        left: {
                            type: 'Variable',
                            start: 13,
                            end: 31,
                            name: 'adguard_ext_safari',
                        },
                    },
                },
            },
            right: {
                type: 'Parenthesis',
                start: 37,
                end: 106,
                expression: {
                    type: 'Operator',
                    start: 37,
                    end: 106,
                    operator: '||',
                    left: {
                        type: 'Variable',
                        start: 37,
                        end: 56,
                        name: 'adguard_ext_android',
                    },
                    right: {
                        type: 'Parenthesis',
                        start: 61,
                        end: 106,
                        expression: {
                            type: 'Operator',
                            start: 61,
                            end: 106,
                            operator: '&&',
                            left: {
                                type: 'Variable',
                                start: 61,
                                end: 81,
                                name: 'adguard_ext_chromium',
                            },
                            right: {
                                type: 'Parenthesis',
                                start: 86,
                                end: 106,
                                expression: {
                                    type: 'Operator',
                                    start: 86,
                                    end: 106,
                                    operator: '!',
                                    left: {
                                        type: 'Variable',
                                        start: 87,
                                        end: 106,
                                        name: 'adguard_ext_firefox',
                                    },
                                },
                            },
                        },
                    },
                },
            },
        });
    });

    describe('parser options should work as expected', () => {
        test.each<{ actual: string; expected: AnyExpressionNode }>([
            {
                actual: '!a',
                expected: {
                    type: 'Operator',
                    operator: '!',
                    left: {
                        type: 'Variable',
                        name: 'a',
                    },
                },
            },
        ])('isLocIncluded should work for $actual', ({ actual, expected }) => {
            expect(LogicalExpressionParser.parse(actual, { isLocIncluded: false })).toEqual(expected);
        });
    });

    test('generate', () => {
        const parseAndGenerate = (source: string) => {
            const ast = LogicalExpressionParser.parse(source);

            if (ast) {
                return LogicalExpressionGenerator.generate(ast);
            }

            return null;
        };

        // TODO: Refactor to test.each
        expect(parseAndGenerate('a')).toEqual('a');
        expect(parseAndGenerate('!a')).toEqual('!a');
        expect(parseAndGenerate('!!a')).toEqual('!!a');
        expect(parseAndGenerate('!(!a)')).toEqual('!(!a)');

        expect(parseAndGenerate('a||b')).toEqual('a || b');
        expect(parseAndGenerate('a || b')).toEqual('a || b');

        expect(parseAndGenerate('!a||b')).toEqual('!a || b');
        expect(parseAndGenerate('a || !b')).toEqual('a || !b');

        expect(parseAndGenerate('!(a)||b')).toEqual('!(a) || b');
        expect(parseAndGenerate('a || !(b)')).toEqual('a || !(b)');

        expect(parseAndGenerate('(!a)||b')).toEqual('(!a) || b');
        expect(parseAndGenerate('a || (!b)')).toEqual('a || (!b)');

        expect(parseAndGenerate('a&&b')).toEqual('a && b');
        expect(parseAndGenerate('a && b')).toEqual('a && b');

        expect(parseAndGenerate('(a)')).toEqual('(a)');
        expect(parseAndGenerate('(a||b)')).toEqual('(a || b)');
        expect(parseAndGenerate('(a || b)')).toEqual('(a || b)');
        expect(parseAndGenerate('((a) || b)')).toEqual('((a) || b)');
        expect(parseAndGenerate('((((a))) || b)')).toEqual('((((a))) || b)');
        expect(parseAndGenerate('((a) || ((b)))')).toEqual('((a) || ((b)))');
        expect(parseAndGenerate('((a) || (!(b)))')).toEqual('((a) || (!(b)))');

        expect(parseAndGenerate('(a&&b)')).toEqual('(a && b)');
        expect(parseAndGenerate('(a && b)')).toEqual('(a && b)');
        expect(parseAndGenerate('((a) && b)')).toEqual('((a) && b)');
        expect(parseAndGenerate('((((a))) && b)')).toEqual('((((a))) && b)');
        expect(parseAndGenerate('((a) && ((b)))')).toEqual('((a) && ((b)))');
        expect(parseAndGenerate('((a) && (!(b)))')).toEqual('((a) && (!(b)))');

        expect(parseAndGenerate('((a) || (!(b))) && c')).toEqual('((a) || (!(b))) && c');
        expect(parseAndGenerate('((!!a) || (!(b))) && ((!!(!!c)))')).toEqual('((!!a) || (!(b))) && ((!!(!!c)))');

        expect(parseAndGenerate(
            // eslint-disable-next-line max-len
            '(adguard && !adguard_ext_safari) && (adguard_ext_android || (adguard_ext_chromium && (!adguard_ext_firefox)))',
        )).toEqual(
            // eslint-disable-next-line max-len
            '(adguard && !adguard_ext_safari) && (adguard_ext_android || (adguard_ext_chromium && (!adguard_ext_firefox)))',
        );

        expect(parseAndGenerate(
            // eslint-disable-next-line max-len
            '(((adguard)) && !adguard_ext_safari) && ((adguard_ext_android) || (adguard_ext_chromium && (!adguard_ext_firefox)))',
        )).toEqual(
            // eslint-disable-next-line max-len
            '(((adguard)) && !adguard_ext_safari) && ((adguard_ext_android) || (adguard_ext_chromium && (!adguard_ext_firefox)))',
        );

        // Invalid AST
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        expect(() => LogicalExpressionGenerator.generate(<any>{ type: 'Unknown' })).toThrowError(
            'Unexpected node type',
        );
    });

    describe('serialize & deserialize', () => {
        test.each([
            // simple expressions
            'a',
            '(a)',
            '!a',
            '!!a',
            '!(!a)',
            'a||b',

            // complex expressions
            '((!!a) || (!(b))) && ((!!(!!c)))',
            // eslint-disable-next-line max-len
            '(adguard && !adguard_ext_safari) && (adguard_ext_android || (adguard_ext_chromium && (!adguard_ext_firefox)))',
        ])("should serialize and deserialize '%p'", async (input) => {
            await expect(input).toBeSerializedAndDeserializedProperly(
                LogicalExpressionParser,
                LogicalExpressionGenerator,
                LogicalExpressionSerializer,
                LogicalExpressionDeserializer,
            );
        });
    });
});
