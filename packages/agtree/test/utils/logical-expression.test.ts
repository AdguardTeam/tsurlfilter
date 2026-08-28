import { describe, expect, test } from 'vitest';

import {
    type AnyExpressionNode,
    type ExpressionVariableNode,
    NodeType,
    OperatorValue,
} from '../../src/nodes';
import { LogicalExpressionUtils } from '../../src/utils/logical-expression';

// eslint-disable-next-line jsdoc/require-jsdoc
const variable = (name: string): ExpressionVariableNode => ({
    type: NodeType.Variable,
    name,
    start: 0,
    end: name.length,
});

// eslint-disable-next-line jsdoc/require-jsdoc
const not = (expr: AnyExpressionNode): AnyExpressionNode => ({
    type: NodeType.Operator,
    operator: OperatorValue.Not,
    left: expr,
    start: 0,
    end: 0,
});

// eslint-disable-next-line jsdoc/require-jsdoc
const and = (left: AnyExpressionNode, right: AnyExpressionNode): AnyExpressionNode => ({
    type: NodeType.Operator,
    operator: OperatorValue.And,
    left,
    right,
    start: 0,
    end: 0,
});

// eslint-disable-next-line jsdoc/require-jsdoc
const or = (left: AnyExpressionNode, right: AnyExpressionNode): AnyExpressionNode => ({
    type: NodeType.Operator,
    operator: OperatorValue.Or,
    left,
    right,
    start: 0,
    end: 0,
});

describe('LogicalExpressionUtils', () => {
    test('getVariables', () => {
        // Invalid input
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        expect(() => LogicalExpressionUtils.getVariables(<any>{
            type: 'Invalid',
        })).toThrowError('Unexpected node type');

        expect(
            LogicalExpressionUtils.getVariables(variable('a')),
        ).toMatchObject([
            { type: 'Variable', name: 'a' },
        ]);

        expect(
            LogicalExpressionUtils.getVariables(
                not(not(not(not(variable('a'))))),
            ),
        ).toMatchObject([
            { type: 'Variable', name: 'a' },
        ]);

        expect(
            LogicalExpressionUtils.getVariables(
                or(variable('a'), and(variable('b'), variable('c'))),
            ),
        ).toMatchObject([
            { type: 'Variable', name: 'a' },
            { type: 'Variable', name: 'b' },
            { type: 'Variable', name: 'c' },
        ]);

        expect(
            LogicalExpressionUtils.getVariables(
                and(
                    and(variable('adguard'), not(variable('adguard_ext_safari'))),
                    or(
                        variable('adguard_ext_android'),
                        and(variable('adguard_ext_chromium'), not(variable('adguard_ext_firefox'))),
                    ),
                ),
            ),
        ).toMatchObject([
            { type: 'Variable', name: 'adguard' },
            { type: 'Variable', name: 'adguard_ext_safari' },
            { type: 'Variable', name: 'adguard_ext_android' },
            { type: 'Variable', name: 'adguard_ext_chromium' },
            { type: 'Variable', name: 'adguard_ext_firefox' },
        ]);

        // Lots of parentheses, variables, and operators
        expect(
            LogicalExpressionUtils.getVariables(
                or(
                    and(variable('a'), variable('b')),
                    or(
                        and(variable('c'), variable('d')),
                        or(
                            and(variable('e'), variable('f')),
                            or(
                                and(variable('g'), variable('h')),
                                or(
                                    and(variable('i'), variable('j')),
                                    or(
                                        and(variable('k'), variable('l')),
                                        or(
                                            and(variable('m'), variable('n')),
                                            or(
                                                and(variable('o'), variable('p')),
                                                or(
                                                    and(variable('q'), variable('r')),
                                                    or(
                                                        and(variable('s'), variable('t')),
                                                        or(
                                                            and(variable('u'), variable('v')),
                                                            or(
                                                                and(variable('w'), variable('x')),
                                                                and(variable('y'), variable('z')),
                                                            ),
                                                        ),
                                                    ),
                                                ),
                                            ),
                                        ),
                                    ),
                                ),
                            ),
                        ),
                    ),
                ),
            ),
        ).toMatchObject([
            { type: 'Variable', name: 'a' },
            { type: 'Variable', name: 'b' },
            { type: 'Variable', name: 'c' },
            { type: 'Variable', name: 'd' },
            { type: 'Variable', name: 'e' },
            { type: 'Variable', name: 'f' },
            { type: 'Variable', name: 'g' },
            { type: 'Variable', name: 'h' },
            { type: 'Variable', name: 'i' },
            { type: 'Variable', name: 'j' },
            { type: 'Variable', name: 'k' },
            { type: 'Variable', name: 'l' },
            { type: 'Variable', name: 'm' },
            { type: 'Variable', name: 'n' },
            { type: 'Variable', name: 'o' },
            { type: 'Variable', name: 'p' },
            { type: 'Variable', name: 'q' },
            { type: 'Variable', name: 'r' },
            { type: 'Variable', name: 's' },
            { type: 'Variable', name: 't' },
            { type: 'Variable', name: 'u' },
            { type: 'Variable', name: 'v' },
            { type: 'Variable', name: 'w' },
            { type: 'Variable', name: 'x' },
            { type: 'Variable', name: 'y' },
            { type: 'Variable', name: 'z' },
        ]);
    });

    test('evaluate', () => {
        // Invalid AST
        expect(() => LogicalExpressionUtils.evaluate(
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            <any>{ type: 'Invalid' },
            {},
        )).toThrowError("Unexpected node type 'Invalid'");

        // Invalid right operand
        expect(() => LogicalExpressionUtils.evaluate(
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            <any>{ type: 'Operator', operator: '&&' },
            {},
        )).toThrowError("Unexpected operator '&&'");

        expect(() => LogicalExpressionUtils.evaluate(
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            <any>{ type: 'Operator', operator: '||' },
            {},
        )).toThrowError("Unexpected operator '||'");

        // Variable itself
        expect(LogicalExpressionUtils.evaluate(variable('a'), { a: true })).toBeTruthy();
        expect(LogicalExpressionUtils.evaluate(variable('a'), { a: false })).toBeFalsy();

        // Not operator
        expect(LogicalExpressionUtils.evaluate(not(variable('a')), { a: false })).toBeTruthy();
        expect(LogicalExpressionUtils.evaluate(not(variable('a')), { a: true })).toBeFalsy();
        expect(LogicalExpressionUtils.evaluate(not(not(variable('a'))), { a: true })).toBeTruthy();
        expect(LogicalExpressionUtils.evaluate(not(not(variable('a'))), { a: false })).toBeFalsy();
        expect(LogicalExpressionUtils.evaluate(not(not(not(variable('a')))), { a: false })).toBeTruthy();
        expect(LogicalExpressionUtils.evaluate(not(not(not(not(variable('a'))))), { a: false })).toBeFalsy();

        // And operator
        expect(LogicalExpressionUtils.evaluate(and(variable('a'), variable('b')), { a: false, b: true })).toBeFalsy();
        expect(LogicalExpressionUtils.evaluate(and(variable('a'), variable('b')), { a: true, b: false })).toBeFalsy();
        expect(LogicalExpressionUtils.evaluate(and(variable('a'), variable('b')), { a: true, b: true })).toBeTruthy();
        expect(LogicalExpressionUtils.evaluate(and(variable('a'), variable('b')), { a: true, b: true })).toBeTruthy();
        expect(LogicalExpressionUtils.evaluate(
            and(and(variable('a'), variable('b')), not(variable('c'))),
            { a: true, b: true, c: false },
        )).toBeTruthy();
        expect(LogicalExpressionUtils.evaluate(
            and(and(variable('a'), variable('b')), not(not(not(variable('c'))))),
            { a: true, b: true, c: false },
        )).toBeTruthy();

        // Or operator
        expect(LogicalExpressionUtils.evaluate(or(variable('a'), variable('b')), { a: false, b: true })).toBeTruthy();
        expect(LogicalExpressionUtils.evaluate(or(variable('a'), variable('b')), { a: true, b: false })).toBeTruthy();
        expect(LogicalExpressionUtils.evaluate(or(variable('a'), variable('b')), { a: true, b: true })).toBeTruthy();
        expect(LogicalExpressionUtils.evaluate(or(variable('a'), variable('b')), { a: true, b: true })).toBeTruthy();
        expect(LogicalExpressionUtils.evaluate(
            or(or(variable('a'), variable('b')), not(variable('c'))),
            { a: false, b: false, c: false },
        )).toBeTruthy();

        // Complex expression
        expect(LogicalExpressionUtils.evaluate(
            and(
                and(variable('a'), not(variable('b'))),
                or(variable('c'), and(variable('d'), not(variable('e')))),
            ),
            {
                a: true, b: false, c: true, d: true, e: false,
            },
        )).toBeTruthy();
    });
});
