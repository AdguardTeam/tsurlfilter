/**
 * @file Utility functions for logical expression AST.
 */

import { type AnyExpressionNode, type ExpressionVariableNode } from '../parser/common';

/**
 * Variable table. Key is variable name, value is boolean.
 */
export type VariableTable = { [key: string]: boolean };

/**
 * Utility functions for logical expression AST.
 */
export class LogicalExpressionUtils {
    /**
     * Get all variables in the expression.
     *
     * @param ast Logical expression AST
     * @returns List of variables in the expression (nodes)
     * @example
     * If the expression is `a && b || c`, the returned list will be
     * nodes for `a`, `b`, and `c`.
     */
    public static getVariables(ast: AnyExpressionNode): ExpressionVariableNode[] {
        if (ast.type === 'Variable') {
            return [ast];
        } if (ast.type === 'Operator') {
            const leftVars = LogicalExpressionUtils.getVariables(ast.left);
            const rightVars = ast.right ? LogicalExpressionUtils.getVariables(ast.right) : [];
            return [...leftVars, ...rightVars];
        } if (ast.type === 'Parenthesis') {
            return LogicalExpressionUtils.getVariables(ast.expression);
        }

        throw new Error('Unexpected node type');
    }

    /**
     * Evaluate the parsed logical expression. You'll need to provide a
     * variable table.
     *
     * @param ast Logical expression AST
     * @param table Variable table (key: variable name, value: boolean)
     * @returns Evaluation result
     * @example
     * If the expression is `a && b`, and the variable table is
     * `{ a: true, b: false }`, the result will be `false`.
     *
     * Example code:
     * ```js
     * LogicalExpressionUtils.evaluate(
     *     LogicalExpressionParser.parse('a && b'),
     *     { a: true, b: false }
     * );
     * ```
     */
    public static evaluate(ast: AnyExpressionNode, table: VariableTable): boolean {
        if (ast.type === 'Variable') {
            return !!table[ast.name];
        } if (ast.type === 'Operator') {
            if (ast.operator === '&&' || ast.operator === '||') {
                if (!ast.right) {
                    throw new Error('Unexpected right operand');
                }
                if (ast.operator === '&&') {
                    // eslint-disable-next-line max-len
                    return LogicalExpressionUtils.evaluate(ast.left, table) && LogicalExpressionUtils.evaluate(ast.right, table);
                } if (ast.operator === '||') {
                    // eslint-disable-next-line max-len
                    return LogicalExpressionUtils.evaluate(ast.left, table) || LogicalExpressionUtils.evaluate(ast.right, table);
                }
            } else if (ast.operator === '!') {
                return !LogicalExpressionUtils.evaluate(ast.left, table);
            }
        } else if (ast.type === 'Parenthesis') {
            return LogicalExpressionUtils.evaluate(ast.expression, table);
        }

        throw new Error(`Unexpected AST node type '${ast.type}'`);
    }
}
