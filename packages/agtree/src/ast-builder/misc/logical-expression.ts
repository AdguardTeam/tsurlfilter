/**
 * @file Logical expression AST parser.
 *
 * Converts the flat `Int32Array` buffer produced by
 * `LogicalExpressionParser` into a tree of
 * `AnyExpressionNode` objects compatible with the rest of the agtree AST.
 */

import {
    type AnyExpressionNode,
    type ExpressionOperatorNode,
    type ExpressionParenthesisNode,
    type ExpressionVariableNode,
    NodeType,
    OperatorValue,
} from '../../nodes';
import {
    LE_HEADER,
    LE_KIND,
    LE_KIND_AND,
    LE_KIND_NOT,
    LE_KIND_OR,
    LE_KIND_PAR,
    LE_KIND_VAR,
    LE_LEFT,
    LE_RIGHT,
    LE_ROOT,
    LE_SRC_END,
    LE_SRC_START,
    LE_STRIDE,
} from '../../parser/misc/logical-expression';

/**
 * Converts the flat parser buffer into `AnyExpressionNode` AST objects.
 *
 * This is the companion of `LogicalExpressionParser`: the parser
 * records structural indices; this class materialises the actual node objects.
 */
export class LogicalExpressionAstBuilder {
    /**
     * Builds an `AnyExpressionNode` tree from a parser buffer.
     *
     * @param source Original source string (used to extract variable names).
     * @param buf Buffer written by `LogicalExpressionParser.parse`.
     * @param isLocIncluded Whether to attach `start`/`end` offsets to nodes.
     *
     * @returns Root `AnyExpressionNode`.
     *
     * @throws When the buffer contains no valid expression (root is -1).
     */
    public static parse(source: string, buf: Int32Array, isLocIncluded = false): AnyExpressionNode {
        const root = buf[LE_ROOT];

        if (root === -1) {
            throw new Error('Empty logical expression: no root node in buffer');
        }

        return LogicalExpressionAstBuilder.buildNode(source, buf, root, isLocIncluded);
    }

    /**
     * Recursively builds an AST node from the flat buffer record at index `i`.
     *
     * @param source Original source string.
     * @param buf Parser output buffer.
     * @param i Node index to materialise.
     * @param isLocIncluded Whether to attach source offsets.
     *
     * @returns Materialised `AnyExpressionNode`.
     */
    private static buildNode(
        source: string,
        buf: Int32Array,
        i: number,
        isLocIncluded: boolean,
    ): AnyExpressionNode {
        const base = LE_HEADER + i * LE_STRIDE;
        const kind = buf[base + LE_KIND];
        const srcStart = buf[base + LE_SRC_START];
        const srcEnd = buf[base + LE_SRC_END];
        const leftIdx = buf[base + LE_LEFT];
        const rightIdx = buf[base + LE_RIGHT];

        if (kind === LE_KIND_VAR) {
            const node: ExpressionVariableNode = {
                type: NodeType.Variable,
                name: source.slice(srcStart, srcEnd),
            };

            if (isLocIncluded) {
                node.start = srcStart;
                node.end = srcEnd;
            }

            return node;
        }

        if (kind === LE_KIND_NOT) {
            const child = LogicalExpressionAstBuilder.buildNode(source, buf, leftIdx, isLocIncluded);

            const node: ExpressionOperatorNode = {
                type: NodeType.Operator,
                operator: OperatorValue.Not,
                left: child,
            };

            if (isLocIncluded) {
                node.start = srcStart;
                node.end = srcEnd;
            }

            return node;
        }

        if (kind === LE_KIND_AND || kind === LE_KIND_OR) {
            const left = LogicalExpressionAstBuilder.buildNode(source, buf, leftIdx, isLocIncluded);
            const right = LogicalExpressionAstBuilder.buildNode(source, buf, rightIdx, isLocIncluded);

            const node: ExpressionOperatorNode = {
                type: NodeType.Operator,
                operator: kind === LE_KIND_AND ? OperatorValue.And : OperatorValue.Or,
                left,
                right,
            };

            if (isLocIncluded) {
                node.start = srcStart;
                node.end = srcEnd;
            }

            return node;
        }

        if (kind === LE_KIND_PAR) {
            const inner = LogicalExpressionAstBuilder.buildNode(source, buf, leftIdx, isLocIncluded);

            const node: ExpressionParenthesisNode = {
                type: NodeType.Parenthesis,
                expression: inner,
            };

            if (isLocIncluded) {
                node.start = srcStart;
                node.end = srcEnd;
            }

            return node;
        }

        throw new Error(`Unknown logical expression node kind: ${kind}`);
    }
}
