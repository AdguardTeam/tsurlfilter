/**
 * @file Adblock filter list converter
 */

import { RuleConverter } from '.';
import { createFilterListNode } from '../ast-utils/filter-list';
import { type FilterList } from '../parser/common';
import { ConverterBase } from './base-interfaces/converter-base';

/**
 * Adblock filter list converter class
 *
 * This class just provides an extra layer on top of the {@link RuleConverter}
 * and can be used to convert entire filter lists.
 *
 * @todo Implement `convertToUbo` and `convertToAbp`
 * @todo Implement tolerant mode, which will allow to convert a filter list
 * even if some of its rules are invalid
 */
export class FilterListConverter extends ConverterBase {
    /**
     * Converts an adblock filter list to AdGuard format, if possible.
     *
     * @param filterListNode Filter list node to convert
     * @returns Converted filter list node
     * @throws If the filter list is invalid or cannot be converted
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
