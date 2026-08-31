/**
 * @file Traversal handlers for network rule AST nodes.
 */

import type {
    HostnameList,
    HostRule,
    Modifier,
    ModifierList,
    NetworkRule,
} from '../../nodes';

import type { VisitChildFn } from './misc';

/**
 * Visit children of a ModifierList node.
 *
 * @param node ModifierList node.
 * @param visitChild Callback to visit each child.
 * @param reverse Whether to iterate in reverse.
 */
export function visitModifierList(node: ModifierList, visitChild: VisitChildFn, reverse: boolean): void {
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
 * Visit children of a Modifier node.
 *
 * @param node Modifier node.
 * @param visitChild Callback to visit each child.
 * @param reverse Whether to iterate in reverse.
 */
export function visitModifier(node: Modifier, visitChild: VisitChildFn, reverse: boolean): void {
    if (reverse) {
        if (node.value !== undefined) {
            if (!visitChild(node.value, node)) {
                return;
            }
        }
        visitChild(node.name, node);
    } else {
        if (!visitChild(node.name, node)) {
            return;
        }
        if (node.value !== undefined) {
            visitChild(node.value, node);
        }
    }
}

/**
 * Visit children of a NetworkRule node.
 *
 * @param node NetworkRule node.
 * @param visitChild Callback to visit each child.
 * @param reverse Whether to iterate in reverse.
 */
export function visitNetworkRule(node: NetworkRule, visitChild: VisitChildFn, reverse: boolean): void {
    if (reverse) {
        if (node.modifiers !== undefined) {
            if (!visitChild(node.modifiers, node)) {
                return;
            }
        }
        visitChild(node.pattern, node);
    } else {
        if (!visitChild(node.pattern, node)) {
            return;
        }
        if (node.modifiers !== undefined) {
            visitChild(node.modifiers, node);
        }
    }
}

/**
 * Visit children of a HostnameList node.
 *
 * @param node HostnameList node.
 * @param visitChild Callback to visit each child.
 * @param reverse Whether to iterate in reverse.
 */
export function visitHostnameList(node: HostnameList, visitChild: VisitChildFn, reverse: boolean): void {
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
 * Visit children of a HostRule node.
 *
 * @param node HostRule node.
 * @param visitChild Callback to visit each child.
 * @param reverse Whether to iterate in reverse.
 */
export function visitHostRule(node: HostRule, visitChild: VisitChildFn, reverse: boolean): void {
    if (reverse) {
        if (node.comment !== undefined) {
            if (!visitChild(node.comment, node)) {
                return;
            }
        }
        if (!visitChild(node.hostnames, node)) {
            return;
        }
        visitChild(node.ip, node);
    } else {
        if (!visitChild(node.ip, node)) {
            return;
        }
        if (!visitChild(node.hostnames, node)) {
            return;
        }
        if (node.comment !== undefined) {
            visitChild(node.comment, node);
        }
    }
}
