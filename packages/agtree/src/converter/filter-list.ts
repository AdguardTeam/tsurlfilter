/**
 * @file Filter list converter
 */

import { RuleConverter } from '.';
import { createFilterListNode } from '../ast-utils/filter-list';
import { FilterList } from '../parser/common';
import { ConverterBase } from './base-interfaces/converter-base';

/**
 * Filter list converter class
 *
 * @todo Implement `convertToUbo` and `convertToAbp`
 */
export class FilterListConverter extends ConverterBase {
    /**
     * Converts a filter list to AdGuard format
     *
     * @param filterListNode Filter list AST node to convert
     * @returns Converted filter list AST node
     */
    public static convertToAdg(filterListNode: FilterList): FilterList {
        const result = createFilterListNode();

        // Iterate over the filtering rules and convert them one by one,
        // then add them to the result (one conversion may result in multiple rules)
        for (const ruleNode of filterListNode.children) {
            const convertedRules = RuleConverter.convertToAdg(ruleNode);
            result.children.push(...convertedRules);
        }

        return result;
    }
}
