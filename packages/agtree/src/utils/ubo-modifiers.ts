/**
 * @file Utility to extract UBO rule modifiers from a selector list
 *
 * uBO rule modifiers are special pseudo-classes that are used to specify
 * the rule's behavior, for example, if you want to apply the rule only
 * to a specific path, you can use the `:matches-path(...)` pseudo-class.
 */

import {
    type SelectorList,
    walk,
    type CssNode,
    type ListItem,
    type List,
    type SelectorListPlain,
    fromPlainObject,
    toPlainObject,
    type SelectorPlain,
    type Selector,
} from '@adguard/ecss-tree';
import cloneDeep from 'clone-deep';

import { type ModifierList } from '../parser/common';
import { createModifierNode } from '../ast-utils/modifiers';
import { CssTreeNodeType } from './csstree-constants';
import { SPACE } from './constants';
import { CssTree } from './csstree';
import { isUndefined } from './common';

const UBO_MODIFIERS_INDICATOR = ':matches-';
const MATCHES_PATH_OPERATOR = 'matches-path';
const NOT_OPERATOR = 'not';

/**
 * List of supported UBO rule modifiers
 */
// TODO: Add support for other modifiers, if needed
const SUPPORTED_UBO_RULE_MODIFIERS = new Set([
    MATCHES_PATH_OPERATOR,
]);

type AnySelector = Selector | SelectorPlain;
type AnySelectorList = SelectorList | SelectorListPlain;

/**
 * Extracted UBO rule modifiers
 */
export interface ExtractedUboRuleModifiers<T extends SelectorPlain | SelectorListPlain> {
    /**
     * Parsed uBO rule modifiers
     */
    modifiers: ModifierList;

    /**
     * Selector / selector list AST without the special uBO pseudo-classes
     */
    cleaned: T;
}

/**
 * Helper interface to store a CSSTree node reference while traversing the tree
 */
interface CssNodeRef {
    node: CssNode;
    item: ListItem<CssNode>;
    list: List<CssNode>;
}

/**
 * Fast check to determine if the selector list contains UBO rule modifiers.
 * This function helps to avoid unnecessary walk through the selector list.
 *
 * @param rawSelectorList Raw selector list to check
 * @returns `true` if the selector list contains UBO rule modifiers, `false` otherwise
 */
export function hasUboModifierIndicator(rawSelectorList: string): boolean {
    return rawSelectorList.includes(UBO_MODIFIERS_INDICATOR);
}

/**
 * Helper function that always returns the linked list version of the
 * selector node.
 *
 * @param selector Selector to process
 * @returns Linked list based selector
 */
function convertSelectorToLinkedList(selector: AnySelector): Selector {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return fromPlainObject(cloneDeep(selector as any)) as Selector;
}

/**
 * Helper function that always returns the linked list version of the
 * selector list node.
 *
 * @param selectorList Selector list to process
 * @returns Linked list based selector list
 */
function convertSelectorListToLinkedList(selectorList: AnySelectorList): SelectorList {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return fromPlainObject(cloneDeep(selectorList as any)) as SelectorList;
}

/**
 * Helper function for checking and removing bounding combinators
 *
 * @param ref Reference to the CSSTree node
 * @param name Name to error message
 */
function handleBoundingCombinators(ref: CssNodeRef, name: string): void {
    // Check preceding combinator
    if (ref.item.prev?.data.type === CssTreeNodeType.Combinator) {
        // Special case is space combinator, it's allowed, but should be removed
        if (ref.item.prev.data.name === SPACE) {
            // Remove the combinator
            ref.list?.remove(ref.item.prev);
        } else {
            // Throw an error for other combinator types
            throw new Error(`Unexpected combinator before '${name}'`);
        }
    }

    // Check following combinator
    if (ref.item.next?.data.type === CssTreeNodeType.Combinator) {
        // Special case is space combinator, it's allowed, but should be removed
        if (ref.item.next.data.name === SPACE) {
            // Remove the combinator
            ref.list?.remove(ref.item.next);
        } else {
            // Throw an error for other combinator types
            throw new Error(`Unexpected combinator after '${name}'`);
        }
    }
}

/**
 * Extract UBO rule modifiers from the selector and clean the selector AST from them.
 *
 * @param selector Selector to process (can be linked list or array based)
 * @returns Extracted UBO rule modifiers and cleaned selector list
 */
export function extractUboModifiersFromSelector(selector: AnySelector): ExtractedUboRuleModifiers<SelectorPlain> {
    // We need a linked list based AST here
    const cleaned = convertSelectorToLinkedList(selector);

    // Prepare the modifiers list, we should add the modifiers to it
    const modifiers: ModifierList = {
        type: 'ModifierList',
        children: [],
    };

    let depth = 0;
    let notRef: CssNodeRef | undefined;

    // Walk through the selector nodes
    walk(cleaned, {
        enter: (node: CssNode, item: ListItem<CssNode>, list: List<CssNode>) => {
            // Don't take into account selectors and selector lists
            if (node.type === CssTreeNodeType.Selector || node.type === CssTreeNodeType.SelectorList) {
                return;
            }

            // Set the :not() reference if we are on the top level
            if (node.type === CssTreeNodeType.PseudoClassSelector && node.name === NOT_OPERATOR && depth === 0) {
                notRef = {
                    node,
                    item,
                    list,
                };
            }

            depth += 1;
        },
        leave: (node: CssNode, item: ListItem<CssNode>, list: List<CssNode>) => {
            // Don't take into account selectors and selector lists
            if (node.type === CssTreeNodeType.Selector || node.type === CssTreeNodeType.SelectorList) {
                return;
            }

            if (node.type === CssTreeNodeType.PseudoClassSelector) {
                if (SUPPORTED_UBO_RULE_MODIFIERS.has(node.name)) {
                    // depth should be 1 for :matches-path(...) and 2 for :not(:matches-path(...))
                    if (depth !== (notRef ? 2 : 1)) {
                        throw new Error(`Unexpected depth for ':${node.name}(...)'`);
                    }

                    // uBO modifier can't be preceded nor followed by a combinator
                    handleBoundingCombinators({ node, item, list }, `:${node.name}(...)`);

                    // if we have :not() ref, then we should check if the uBO modifier is the only child of :not()
                    if (notRef && list.size !== 1) {
                        throw new Error(`Unexpected nodes inside ':not(:${node.name}(...))'`);
                    }

                    // Add the modifier to the modifiers list node
                    modifiers.children.push(
                        createModifierNode(
                            node.name,
                            CssTree.generatePseudoClassValue(node),
                            // :not(:matches-path(...)) should be an exception modifier
                            !isUndefined(notRef),
                        ),
                    );

                    if (notRef) {
                        // If we have :not() ref, then we should remove the :not() node
                        // (which also removes the uBO modifier node, since it's the parent
                        // of the uBO modifier node).
                        // But before removing the :not() node, we should check
                        // :not() isn't preceded nor followed by a combinator.
                        handleBoundingCombinators(notRef, `:not(:${node.name}(...))`);
                        notRef.list?.remove(notRef.item);
                    } else {
                        // Otherwise just remove the uBO modifier node
                        list?.remove(item);
                    }
                }
            }

            depth -= 1;

            // Reset the :not() ref if we're leaving the :not() node at the top level
            if (node.type === CssTreeNodeType.PseudoClassSelector && node.name === NOT_OPERATOR && depth === 0) {
                notRef = undefined;
            }
        },
    });

    return {
        modifiers,
        cleaned: toPlainObject(cleaned) as SelectorPlain,
    };
}

/**
 * Extract UBO rule modifiers from the selector list and clean the selector
 * list AST from them.
 *
 * @param selectorList Selector list to process (can be linked list or array based)
 * @returns Extracted UBO rule modifiers and cleaned selector list
 * @example
 * If you have the following adblock rule:
 * ```adblock
 * ##:matches-path(/path) .foo > .bar:has(.baz)
 * ```
 * Then this function extracts the `:matches-path(/path)` pseudo-class as
 * a rule modifier with key `matches-path` and value `/path` and and returns
 * the following selector list:
 * ```css
 * .foo > .bar:has(.baz)
 * ```
 * (this is the 'cleaned' selector list - a selector list without the
 * special uBO pseudo-classes)
 */
export function extractUboModifiersFromSelectorList(
    selectorList: AnySelectorList,
): ExtractedUboRuleModifiers<SelectorListPlain> {
    // We need a linked list based AST here
    const cleaned = convertSelectorListToLinkedList(selectorList);

    // Prepare the modifiers list, we should add the modifiers to it
    const modifiers: ModifierList = {
        type: 'ModifierList',
        children: [],
    };

    // Walk through the selector list nodes
    cleaned.children.forEach((child: CssNode) => {
        if (child.type === CssTreeNodeType.Selector) {
            const result = extractUboModifiersFromSelector(child);

            // Add the modifiers to the modifiers list
            modifiers.children.push(...result.modifiers.children);

            // Replace the selector with the cleaned one
            Object.assign(child, result.cleaned);
        }
    });

    return {
        modifiers,
        cleaned: toPlainObject(cleaned) as SelectorListPlain,
    };
}
