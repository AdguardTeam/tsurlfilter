import { type AnyExpressionNode } from '../../../src/parser/common';
import { LogicalExpressionParser } from '../../../src/parser/misc/logical-expression';

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
            loc: {
                start: {
                    offset: 0,
                },
                end: {
                    offset: 1,
                },
            },
            name: 'a',
        });

        expect(LogicalExpressionParser.parse('!a')).toMatchObject({
            type: 'Operator',
            loc: {
                start: {
                    offset: 0,
                },
                end: {
                    offset: 2,
                },
            },
            operator: '!',
            left: {
                type: 'Variable',
                loc: {
                    start: {
                        offset: 1,
                    },
                    end: {
                        offset: 2,
                    },
                },
                name: 'a',
            },
        });

        expect(LogicalExpressionParser.parse('!!a')).toMatchObject({
            type: 'Operator',
            loc: {
                start: {
                    offset: 0,
                },
                end: {
                    offset: 3,
                },
            },
            operator: '!',
            left: {
                type: 'Operator',
                loc: {
                    start: {
                        offset: 1,
                    },
                    end: {
                        offset: 3,
                    },
                },
                operator: '!',
                left: {
                    type: 'Variable',
                    loc: {
                        start: {
                            offset: 2,
                        },
                        end: {
                            offset: 3,
                        },
                    },
                    name: 'a',
                },
            },
        });

        expect(LogicalExpressionParser.parse('!(!a)')).toMatchObject({

            type: 'Operator',
            loc: {
                start: {
                    offset: 0,
                },
                end: {
                    offset: 4,
                },
            },
            operator: '!',
            left: {
                type: 'Parenthesis',
                loc: {
                    start: {
                        offset: 2,
                    },
                    end: {
                        offset: 4,
                    },
                },
                expression: {
                    type: 'Operator',
                    loc: {
                        start: {
                            offset: 2,
                        },
                        end: {
                            offset: 4,
                        },
                    },
                    operator: '!',
                    left: {
                        type: 'Variable',
                        loc: {
                            start: {
                                offset: 3,
                            },
                            end: {
                                offset: 4,
                            },
                        },
                        name: 'a',
                    },
                },
            },
        });

        expect(LogicalExpressionParser.parse('a||b')).toMatchObject({
            type: 'Operator',
            loc: {
                start: {
                    offset: 0,
                },
                end: {
                    offset: 4,
                },
            },
            operator: '||',
            left: {
                type: 'Variable',
                loc: {
                    start: {
                        offset: 0,
                    },
                    end: {
                        offset: 1,
                    },
                },
                name: 'a',
            },
            right: {
                type: 'Variable',
                loc: {
                    start: {
                        offset: 3,
                    },
                    end: {
                        offset: 4,
                    },
                },
                name: 'b',
            },
        });

        expect(LogicalExpressionParser.parse('a || b')).toMatchObject({
            type: 'Operator',
            loc: {
                start: {
                    offset: 0,
                },
                end: {
                    offset: 6,
                },
            },
            operator: '||',
            left: {
                type: 'Variable',
                loc: {
                    start: {
                        offset: 0,
                    },
                    end: {
                        offset: 1,
                    },
                },
                name: 'a',
            },
            right: {
                type: 'Variable',
                loc: {
                    start: {
                        offset: 5,
                    },
                    end: {
                        offset: 6,
                    },
                },
                name: 'b',
            },
        });

        expect(LogicalExpressionParser.parse('(a)')).toMatchObject({
            type: 'Parenthesis',
            loc: {
                start: {
                    offset: 1,
                },
                end: {
                    offset: 2,
                },
            },
            expression: {
                type: 'Variable',
                loc: {
                    start: {
                        offset: 1,
                    },
                    end: {
                        offset: 2,
                    },
                },
                name: 'a',
            },
        });

        expect(LogicalExpressionParser.parse('(a||b)')).toMatchObject({
            type: 'Parenthesis',
            loc: {
                start: {
                    offset: 1,
                },
                end: {
                    offset: 5,
                },
            },
            expression: {
                type: 'Operator',
                loc: {
                    start: {
                        offset: 1,
                    },
                    end: {
                        offset: 5,
                    },
                },
                operator: '||',
                left: {
                    type: 'Variable',
                    loc: {
                        start: {
                            offset: 1,
                        },
                        end: {
                            offset: 2,
                        },
                    },
                    name: 'a',
                },
                right: {
                    type: 'Variable',
                    loc: {
                        start: {
                            offset: 4,
                        },
                        end: {
                            offset: 5,
                        },
                    },
                    name: 'b',
                },
            },
        });

        expect(LogicalExpressionParser.parse('((a) && (!(b)))')).toMatchObject({
            type: 'Parenthesis',
            loc: {
                start: {
                    offset: 2,
                },
                end: {
                    offset: 12,
                },
            },
            expression: {
                type: 'Operator',
                loc: {
                    start: {
                        offset: 2,
                    },
                    end: {
                        offset: 12,
                    },
                },
                operator: '&&',
                left: {
                    type: 'Parenthesis',
                    loc: {
                        start: {
                            offset: 2,
                        },
                        end: {
                            offset: 3,
                        },
                    },
                    expression: {
                        type: 'Variable',
                        loc: {
                            start: {
                                offset: 2,
                            },
                            end: {
                                offset: 3,
                            },
                        },
                        name: 'a',
                    },
                },
                right: {
                    type: 'Parenthesis',
                    loc: {
                        start: {
                            offset: 9,
                        },
                        end: {
                            offset: 12,
                        },
                    },
                    expression: {
                        type: 'Operator',
                        loc: {
                            start: {
                                offset: 9,
                            },
                            end: {
                                offset: 12,
                            },
                        },
                        operator: '!',
                        left: {
                            type: 'Parenthesis',
                            loc: {
                                start: {
                                    offset: 11,
                                },
                                end: {
                                    offset: 12,
                                },
                            },
                            expression: {
                                type: 'Variable',
                                loc: {
                                    start: {
                                        offset: 11,
                                    },
                                    end: {
                                        offset: 12,
                                    },
                                },
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
            loc: {
                start: {
                    offset: 1,
                    line: 1,
                    column: 2,
                },
                end: {
                    offset: 106,
                    line: 1,
                    column: 107,
                },
            },
            operator: '&&',
            left: {
                type: 'Parenthesis',
                loc: {
                    start: {
                        offset: 1,
                        line: 1,
                        column: 2,
                    },
                    end: {
                        offset: 31,
                        line: 1,
                        column: 32,
                    },
                },
                expression: {
                    type: 'Operator',
                    loc: {
                        start: {
                            offset: 1,
                            line: 1,
                            column: 2,
                        },
                        end: {
                            offset: 31,
                            line: 1,
                            column: 32,
                        },
                    },
                    operator: '&&',
                    left: {
                        type: 'Variable',
                        loc: {
                            start: {
                                offset: 1,
                                line: 1,
                                column: 2,
                            },
                            end: {
                                offset: 8,
                                line: 1,
                                column: 9,
                            },
                        },
                        name: 'adguard',
                    },
                    right: {
                        type: 'Operator',
                        loc: {
                            start: {
                                offset: 12,
                                line: 1,
                                column: 13,
                            },
                            end: {
                                offset: 31,
                                line: 1,
                                column: 32,
                            },
                        },
                        operator: '!',
                        left: {
                            type: 'Variable',
                            loc: {
                                start: {
                                    offset: 13,
                                    line: 1,
                                    column: 14,
                                },
                                end: {
                                    offset: 31,
                                    line: 1,
                                    column: 32,
                                },
                            },
                            name: 'adguard_ext_safari',
                        },
                    },
                },
            },
            right: {
                type: 'Parenthesis',
                loc: {
                    start: {
                        offset: 37,
                        line: 1,
                        column: 38,
                    },
                    end: {
                        offset: 106,
                        line: 1,
                        column: 107,
                    },
                },
                expression: {
                    type: 'Operator',
                    loc: {
                        start: {
                            offset: 37,
                            line: 1,
                            column: 38,
                        },
                        end: {
                            offset: 106,
                            line: 1,
                            column: 107,
                        },
                    },
                    operator: '||',
                    left: {
                        type: 'Variable',
                        loc: {
                            start: {
                                offset: 37,
                                line: 1,
                                column: 38,
                            },
                            end: {
                                offset: 56,
                                line: 1,
                                column: 57,
                            },
                        },
                        name: 'adguard_ext_android',
                    },
                    right: {
                        type: 'Parenthesis',
                        loc: {
                            start: {
                                offset: 61,
                                line: 1,
                                column: 62,
                            },
                            end: {
                                offset: 106,
                                line: 1,
                                column: 107,
                            },
                        },
                        expression: {
                            type: 'Operator',
                            loc: {
                                start: {
                                    offset: 61,
                                    line: 1,
                                    column: 62,
                                },
                                end: {
                                    offset: 106,
                                    line: 1,
                                    column: 107,
                                },
                            },
                            operator: '&&',
                            left: {
                                type: 'Variable',
                                loc: {
                                    start: {
                                        offset: 61,
                                        line: 1,
                                        column: 62,
                                    },
                                    end: {
                                        offset: 81,
                                        line: 1,
                                        column: 82,
                                    },
                                },
                                name: 'adguard_ext_chromium',
                            },
                            right: {
                                type: 'Parenthesis',
                                loc: {
                                    start: {
                                        offset: 86,
                                        line: 1,
                                        column: 87,
                                    },
                                    end: {
                                        offset: 106,
                                        line: 1,
                                        column: 107,
                                    },
                                },
                                expression: {
                                    type: 'Operator',
                                    loc: {
                                        start: {
                                            offset: 86,
                                            line: 1,
                                            column: 87,
                                        },
                                        end: {
                                            offset: 106,
                                            line: 1,
                                            column: 107,
                                        },
                                    },
                                    operator: '!',
                                    left: {
                                        type: 'Variable',
                                        loc: {
                                            start: {
                                                offset: 87,
                                                line: 1,
                                                column: 88,
                                            },
                                            end: {
                                                offset: 106,
                                                line: 1,
                                                column: 107,
                                            },
                                        },
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
                return LogicalExpressionParser.generate(ast);
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
        expect(() => LogicalExpressionParser.generate(<any>{ type: 'Unknown' })).toThrowError(
            'Unexpected node type',
        );
    });
});
