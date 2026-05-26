/**
 * @file Core walk() function — depth-first AST traversal.
 */

import type { AnyWalkNode, WalkOptions } from './types';
import { WalkAction } from './types';
import { visitNodeChildren } from './visit-node';

/**
 * Performs a depth-first traversal of an AST starting from the given root node.
 *
 * @template C Context type.
 *
 * @param root The root node to begin traversal from.
 * @param options Walk options (enter, leave, reverse, filter, context).
 */
export function walk<C = undefined>(root: AnyWalkNode, options: WalkOptions<C>): void {
    const {
        enter,
        leave,
        reverse = false,
        filter,
        context,
    } = options;

    // Use a flag to track stop state — avoids allocations in the hot path
    let stopped = false;

    /**
     * Visit a single node: call enter, recurse children, call leave.
     *
     * @param node Current node.
     * @param parent Parent node (null for root).
     *
     * @returns `false` if traversal was stopped.
     */
    function visit(node: AnyWalkNode, parent: AnyWalkNode | null): boolean {
        if (stopped) { return false; }

        const matchesFilter = filter === undefined || filter.has(node.type);

        // --- Enter ---
        if (enter !== undefined && matchesFilter) {
            const action = enter(node, parent, context as C);
            if (action === WalkAction.Stop) {
                stopped = true;
                return false;
            }
            if (action === WalkAction.Skip) {
                // Skip children but still call leave
                if (leave !== undefined && matchesFilter) {
                    const leaveAction = leave(node, parent, context as C);
                    if (leaveAction === WalkAction.Stop) {
                        stopped = true;
                        return false;
                    }
                }
                return true;
            }
        }

        // --- Visit children ---
        // eslint-disable-next-line @typescript-eslint/no-use-before-define
        visitNodeChildren(node, visitChild, reverse);

        // --- Leave ---
        if (!stopped && leave !== undefined && matchesFilter) {
            const action = leave(node, parent, context as C);
            if (action === WalkAction.Stop) {
                stopped = true;
                return false;
            }
        }

        return !stopped;
    }

    /**
     * VisitChild callback passed to handlers.
     * Returns `true` to continue, `false` to stop.
     *
     * @param child Child node to visit.
     * @param parent Parent of the child.
     *
     * @returns Whether traversal should continue.
     */
    function visitChild(child: AnyWalkNode, parent: AnyWalkNode): boolean {
        return visit(child, parent);
    }

    visit(root, null);
}
