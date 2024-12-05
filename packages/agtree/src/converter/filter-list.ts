/**
 * @file Adblock filter list converter
 */

import { RuleConverter } from './rule';
import { type AnyRule, type FilterList } from '../parser/common';
import { clone } from '../utils/clone';
import { MultiValueMap } from '../utils/multi-value-map';
import { type ConversionResult, createConversionResult } from './base-interfaces/conversion-result';
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
     * @param tolerant Indicates whether the converter should be tolerant to invalid rules. If enabled and a rule is
     * invalid, it will be left as is. If disabled and a rule is invalid, the whole filter list will be failed.
     * Defaults to `true`.
     * @returns An object which follows the {@link ConversionResult} interface. Its `result` property contains
     * the converted node, and its `isConverted` flag indicates whether the original node was converted.
     * If the node was not converted, the result will contain the original node with the same object reference
     * @throws If the filter list is invalid or cannot be converted (if the tolerant mode is disabled)
     */
    public static convertToAdg(filterListNode: FilterList, tolerant = true): ConversionResult<FilterList> {
        // Prepare a map to store the converted rules by their index in the filter list
        const conversionMap = new MultiValueMap<number, AnyRule>();

        // Iterate over the filtering rules and convert them one by one, then add them to the result (one conversion may
        // result in multiple rules)
        for (let i = 0; i < filterListNode.children.length; i += 1) {
            try {
                const convertedRules = RuleConverter.convertToAdg(filterListNode.children[i]);

                // Add the converted rules to the map if they were converted
                if (convertedRules.isConverted) {
                    conversionMap.add(i, ...convertedRules.result);
                }
            } catch (error) {
                // If the tolerant mode is disabled, we should throw an error, this will fail the whole filter list
                // conversion.
                // Otherwise, we just ignore the error and leave the rule as is
                if (!tolerant) {
                    throw error;
                }
            }
        }

        // If the conversion map is empty, it means that no rules were converted, so we can return the original filter
        // list
        if (conversionMap.size === 0) {
            return createConversionResult(filterListNode, false);
        }

        // Otherwise, create a new filter list node with the converted rules
        const convertedFilterList: FilterList = {
            type: 'FilterList',
            children: [],
        };

        // Iterate over the original rules again and add them to the converted filter list, replacing the converted
        // rules with the new ones at the specified indexes
        for (let i = 0; i < filterListNode.children.length; i += 1) {
            const rules = conversionMap.get(i);

            if (rules) {
                convertedFilterList.children.push(...rules);
            } else {
                // We clone the unconverted rules to avoid mutating the original filter list if we return the converted
                // one
                convertedFilterList.children.push(clone(filterListNode.children[i]));
            }
        }

        return createConversionResult(convertedFilterList, true);
    }
}
