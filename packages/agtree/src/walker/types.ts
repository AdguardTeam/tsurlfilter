/**
 * @file Walker type definitions.
 */

import type { AnyNode } from '../nodes';

/**
 * Walk action constants returned by callbacks to control traversal.
 */
export const WalkAction = {
    /**
     * Skip visiting the children of the current node.
     * The `leave` callback for this node will still fire.
     */
    Skip: 'skip',

    /**
     * Stop the entire traversal immediately.
     * No further `enter` or `leave` callbacks will be invoked.
     */
    Stop: 'stop',
} as const;

/**
 * Walk action type — the possible return values from a walk callback.
 */
export type WalkActionType = typeof WalkAction[keyof typeof WalkAction];

/**
 * Union of all concrete node types that the walker can visit.
 * Aliased from {@link AnyNode} in `nodes` — update that type when adding
 * new AST node interfaces to maintain exhaustiveness.
 */
export type AnyWalkNode = AnyNode;

/**
 * Callback function signature for walk enter/leave hooks.
 *
 * @template C Context type.
 */
export type WalkCallback<C> = (
    node: AnyWalkNode,
    parent: AnyWalkNode | null,
    context: C,
) => void | WalkActionType | undefined;

/**
 * Options for the `walk()` function.
 *
 * @template C Context type (defaults to `undefined`).
 */
export interface WalkOptions<C = undefined> {
    /**
     * Callback invoked when a node is first entered (before children).
     */
    enter?: WalkCallback<C>;

    /**
     * Callback invoked after all children of a node have been visited.
     */
    leave?: WalkCallback<C>;

    /**
     * When `true`, iterate children arrays in reverse order.
     */
    reverse?: boolean;

    /**
     * Restrict callbacks to nodes of these type(s).
     * Internal traversal still visits all nodes to reach nested matches.
     * Pass a `Set` of node-type discriminants for O(1) lookup per node.
     */
    filter?: Set<AnyWalkNode['type']>;

    /**
     * User-supplied context object passed to enter/leave callbacks.
     */
    context?: C;
}
