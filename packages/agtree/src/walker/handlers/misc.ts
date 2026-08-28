/**
 * @file Traversal handlers for miscellaneous/shared node types.
 *
 * Each handler receives the node and a `visitChild` callback used to
 * recurse into child nodes. The handler explicitly enumerates every
 * child property for its node type.
 */

import type {
    ExpressionOperatorNode,
    ExpressionParenthesisNode,
    FilterList,
    ParameterList,
} from '../../nodes';
import type { AnyWalkNode } from '../types';

/**
 * Callback type passed to handlers for recursing into child nodes.
 */
export type VisitChildFn = (child: AnyWalkNode, parent: AnyWalkNode) => boolean;

/**
 * Visit children of a FilterList node.
 *
 * @param node FilterList node.
 * @param visitChild Callback to visit each child.
 * @param reverse Whether to iterate in reverse.
 */
export function visitFilterList(node: FilterList, visitChild: VisitChildFn, reverse: boolean): void {
    const { children } = node;
    if (reverse) {
        for (let i = children.length - 1; i >= 0; i -= 1) {
            if (!visitChild(children[i], node)) {
                return;
            }
        }
    } else {
        for (let i = 0; i < children.length; i += 1) {
            if (!visitChild(children[i], node)) {
                return;
            }
        }
    }
}

/**
 * Visit children of a ParameterList node.
 *
 * @param node ParameterList node.
 * @param visitChild Callback to visit each child.
 * @param reverse Whether to iterate in reverse.
 */
export function visitParameterList(node: ParameterList, visitChild: VisitChildFn, reverse: boolean): void {
    const { children } = node;
    if (reverse) {
        for (let i = children.length - 1; i >= 0; i -= 1) {
            const child = children[i];
            if (child !== null) {
                if (!visitChild(child, node)) {
                    return;
                }
            }
        }
    } else {
        for (let i = 0; i < children.length; i += 1) {
            const child = children[i];
            if (child !== null) {
                if (!visitChild(child, node)) {
                    return;
                }
            }
        }
    }
}

/**
 * Visit children of an ExpressionOperatorNode.
 *
 * @param node ExpressionOperatorNode.
 * @param visitChild Callback to visit each child.
 * @param reverse Whether to iterate in reverse.
 */
export function visitExpressionOperator(
    node: ExpressionOperatorNode,
    visitChild: VisitChildFn,
    reverse: boolean,
): void {
    if (reverse) {
        if (node.right !== undefined) {
            if (!visitChild(node.right, node)) {
                return;
            }
        }
        visitChild(node.left, node);
    } else {
        if (!visitChild(node.left, node)) {
            return;
        }
        if (node.right !== undefined) {
            visitChild(node.right, node);
        }
    }
}

/**
 * Visit children of an ExpressionParenthesisNode.
 *
 * @param node ExpressionParenthesisNode.
 * @param visitChild Callback to visit each child.
 */
export function visitExpressionParenthesis(
    node: ExpressionParenthesisNode,
    visitChild: VisitChildFn,
): void {
    visitChild(node.expression, node);
}
