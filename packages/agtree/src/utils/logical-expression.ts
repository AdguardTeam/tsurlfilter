/**
 * @file Utility functions for logical expression node.
 */

import { OperatorValue, type AnyExpressionNode, type ExpressionVariableNode } from '../nodes';
import { NodeType } from '../parser/misc/logical-expression-parser';

const ERROR_PREFIX = {
    UNEXPECTED_NODE_TYPE: 'Unexpected node type',
    UNEXPECTED_OPERATOR: 'Unexpected operator',
};

/**
 * Variable table. Key is variable name, value is boolean.
 */
export type VariableTable = { [key: string]: boolean };

/**
 * Utility functions for logical expression node.
 */
export class LogicalExpressionUtils {
    /**
     * Get all variables in the expression.
     *
     * @param node Logical expression node
     * @returns List of variables in the expression (nodes)
     * @example
     * If the expression is `a && b || c`, the returned list will be
     * nodes for `a`, `b`, and `c`.
     */
    public static getVariables(node: AnyExpressionNode): ExpressionVariableNode[] {
        if (node.type === NodeType.Variable) {
            return [node];
        } if (node.type === NodeType.Operator) {
            const leftVars = LogicalExpressionUtils.getVariables(node.left);
            const rightVars = node.right ? LogicalExpressionUtils.getVariables(node.right) : [];
            return [...leftVars, ...rightVars];
        } if (node.type === NodeType.Parenthesis) {
            return LogicalExpressionUtils.getVariables(node.expression);
        }

        throw new Error(ERROR_PREFIX.UNEXPECTED_NODE_TYPE);
    }

    /**
     * Evaluate the parsed logical expression. You'll need to provide a
     * variable table.
     *
     * @param node Logical expression node
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
    public static evaluate(node: AnyExpressionNode, table: VariableTable): boolean {
        if (node.type === NodeType.Variable) {
            return !!table[node.name];
        } if (node.type === NodeType.Operator) {
            if (node.operator === OperatorValue.And || node.operator === OperatorValue.Or) {
                if (!node.right) {
                    throw new Error(`${ERROR_PREFIX.UNEXPECTED_OPERATOR} '${node.operator}'`);
                }
                if (node.operator === OperatorValue.And) {
                    // eslint-disable-next-line max-len
                    return LogicalExpressionUtils.evaluate(node.left, table) && LogicalExpressionUtils.evaluate(node.right, table);
                } if (node.operator === OperatorValue.Or) {
                    // eslint-disable-next-line max-len
                    return LogicalExpressionUtils.evaluate(node.left, table) || LogicalExpressionUtils.evaluate(node.right, table);
                }
            } else if (node.operator === OperatorValue.Not) {
                return !LogicalExpressionUtils.evaluate(node.left, table);
            }
        } else if (node.type === NodeType.Parenthesis) {
            return LogicalExpressionUtils.evaluate(node.expression, table);
        }

        throw new Error(`${ERROR_PREFIX.UNEXPECTED_NODE_TYPE} '${node.type}'`);
    }
}
