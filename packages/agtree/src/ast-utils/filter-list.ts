/**
 * @file Utility functions for working with filter list nodes
 */

import cloneDeep from 'clone-deep';

import { type AnyRule, type FilterList } from '../parser/common';

/**
 * Creates a filter list node
 *
 * @param rules Rules to put in the list (optional, defaults to an empty list)
 * @returns Filter list node
 */
export function createFilterListNode(rules: AnyRule[] = []): FilterList {
    const result: FilterList = {
        type: 'FilterList',
        children: [],
    };

    // We need to clone the rules to avoid side effects
    if (rules.length > 0) {
        result.children = cloneDeep(rules);
    }

    return result;
}
