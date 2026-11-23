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
 * Type-guard predicate for the generic overloads, so a narrowed search
 * returns the narrowed node type instead of requiring a cast (F-055).
 */
export type FindTypeGuard<N extends AnyWalkNode> = (node: AnyWalkNode) => node is N;

/**
 * Finds the first node matching the predicate in depth-first order.
 *
 * A type-guard predicate narrows the result, so a search for one node type
 * does not need a cast: `find(root, isNetworkRule)` returns
 * `NetworkRule | undefined`.
 *
 * @param root Root node to search from.
 * @param predicate Function that returns `true` for a matching node, or a type
 *   guard narrowing the returned node type.
 *
 * @returns The first matching node, or `undefined` if none found.
 */
export function find<N extends AnyWalkNode = AnyWalkNode>(
    root: AnyWalkNode,
    predicate: FindPredicate | FindTypeGuard<N>,
): N | undefined {
    let result: N | undefined;

    walk(root, {
        enter(node) {
            if (predicate(node)) {
                // The predicate is either a boolean test or a type guard for
                // `N`, so a matching node is an `N`.
                result = node as N;
                return WalkAction.Stop;
            }
            return undefined;
        },
    });

    return result;
}

export function findLast<N extends AnyWalkNode>(
    root: AnyWalkNode,
    predicate: FindTypeGuard<N>,
): N | undefined;
/**
 * Finds the last node matching the predicate in document order.
 * Uses reverse traversal with early stop for efficiency.
 *
 * A type-guard predicate narrows the result.
 *
 * @param root Root node to search from.
 * @param predicate Function that returns `true` for a matching node, or a type
 *   guard narrowing the returned node type.
 *
 * @returns The last matching node in document order, or `undefined` if none found.
 */
export function findLast<N extends AnyWalkNode = AnyWalkNode>(
    root: AnyWalkNode,
    predicate: FindPredicate | FindTypeGuard<N>,
): N | undefined {
    let result: N | undefined;

    walk(root, {
        reverse: true,
        enter(node) {
            if (predicate(node)) {
                result = node as N;
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
 * A type-guard predicate narrows the result array.
 *
 * @param root Root node to search from.
 * @param predicate Function that returns `true` for a matching node, or a type
 *   guard narrowing the returned node type.
 *
 * @returns Array of all matching nodes in document order.
 */
export function findAll<N extends AnyWalkNode = AnyWalkNode>(
    root: AnyWalkNode,
    predicate: FindPredicate | FindTypeGuard<N>,
): N[] {
    const results: N[] = [];

    walk(root, {
        enter(node) {
            if (predicate(node)) {
                results.push(node as N);
            }
            return undefined;
        },
    });

    return results;
}
