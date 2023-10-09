/**
 * @file Utility functions for working with modifier nodes
 */

import { type Modifier, type ModifierList } from '../parser/common';
import { isUndefined } from '../utils/common';
import { clone } from '../utils/clone';

/**
 * Creates a modifier node
 *
 * @param name Name of the modifier
 * @param value Value of the modifier
 * @param exception Whether the modifier is an exception
 * @returns Modifier node
 */
export function createModifierNode(name: string, value: string | undefined = undefined, exception = false): Modifier {
    const result: Modifier = {
        type: 'Modifier',
        exception,
        modifier: {
            type: 'Value',
            value: name,
        },
    };

    if (!isUndefined(value)) {
        result.value = {
            type: 'Value',
            value,
        };
    }

    return result;
}

/**
 * Creates a modifier list node
 *
 * @param modifiers Modifiers to put in the list (optional, defaults to an empty list)
 * @returns Modifier list node
 */
export function createModifierListNode(modifiers: Modifier[] = []): ModifierList {
    const result: ModifierList = {
        type: 'ModifierList',
        // We need to clone the modifiers to avoid side effects
        children: modifiers.length ? clone(modifiers) : [],
    };

    return result;
}
