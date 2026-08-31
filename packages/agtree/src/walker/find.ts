/**
 * @file Utility functions built on top of walk(): find, findLast, findAll.
 */

import type { AnyWalkNode } from './types';
import { WalkAction } from './types';
import { walk } from './walk';

/**
 * Predicate function for find utilities.
 */
export type FindPredicate = (node: AnyWalkNode) => boolean;

/**
 * Finds the first node matching the predicate in depth-first order.
 *
 * @param root Root node to search from.
 * @param predicate Function that returns `true` for a matching node.
 *
 * @returns The first matching node, or `undefined` if none found.
 */
export function find(root: AnyWalkNode, predicate: FindPredicate): AnyWalkNode | undefined {
    let result: AnyWalkNode | undefined;

    walk(root, {
        enter(node) {
            if (predicate(node)) {
                result = node;
                return WalkAction.Stop;
            }
            return undefined;
        },
    });

    return result;
}

/**
 * Finds the last node matching the predicate in document order.
 * Uses reverse traversal with early stop for efficiency.
 *
 * @param root Root node to search from.
 * @param predicate Function that returns `true` for a matching node.
 *
 * @returns The last matching node in document order, or `undefined` if none found.
 */
export function findLast(root: AnyWalkNode, predicate: FindPredicate): AnyWalkNode | undefined {
    let result: AnyWalkNode | undefined;

    walk(root, {
        reverse: true,
        enter(node) {
            if (predicate(node)) {
                result = node;
                return WalkAction.Stop;
            }
            return undefined;
        },
    });

    return result;
}

/**
 * Finds all nodes matching the predicate in depth-first (document) order.
 *
 * @param root Root node to search from.
 * @param predicate Function that returns `true` for a matching node.
 *
 * @returns Array of all matching nodes in document order.
 */
export function findAll(root: AnyWalkNode, predicate: FindPredicate): AnyWalkNode[] {
    const results: AnyWalkNode[] = [];

    walk(root, {
        enter(node) {
            if (predicate(node)) {
                results.push(node);
            }
            return undefined;
        },
    });

    return results;
}
