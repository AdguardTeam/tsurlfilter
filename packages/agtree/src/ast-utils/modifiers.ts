/**
 * @file Utility functions for working with modifier ASTs
 */

import cloneDeep from 'clone-deep';

import { Modifier, ModifierList } from '../parser/common';
import { isUndefined } from '../utils/common';

/**
 * Create a modifier node
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
 * Create a modifier list node
 *
 * @param modifiers Modifiers to put in the list (optional, defaults to an empty list)
 * @returns Modifier list node
 */
export function createModifierListNode(modifiers: Modifier[] = []): ModifierList {
    const result: ModifierList = {
        type: 'ModifierList',
        // We need to clone the modifiers to avoid side effects
        children: cloneDeep(modifiers),
    };

    return result;
}
