/**
 * @file Filter list converter for raw filter lists
 *
 * Technically, this is a wrapper around `FilterListConverter` that works with nodes instead of strings.
 */

import { createConversionResult, type ConversionResult } from './base-interfaces/conversion-result';
import { ConverterBase } from './base-interfaces/converter-base';
import { FilterListParser } from '../parser/filterlist';
import { FilterListConverter } from './filter-list';

/**
 * Adblock filter list converter class.
 *
 * You can use this class to convert string-based filter lists, since most of the converters work with nodes.
 * This class just provides an extra layer on top of the {@link FilterListConverter} and calls the parser/serializer
 * before/after the conversion internally.
 *
 * @todo Implement `convertToUbo` and `convertToAbp`
 */
export class RawFilterListConverter extends ConverterBase {
    /**
     * Converts an adblock filter list text to AdGuard format, if possible.
     *
     * @param rawFilterList Raw filter list text to convert
     * @param tolerant Indicates whether the converter should be tolerant to invalid rules. If enabled and a rule is
     * invalid, it will be left as is. If disabled and a rule is invalid, the whole filter list will be failed.
     * Defaults to `true`.
     * @returns An object which follows the {@link ConversionResult} interface. Its `result` property contains
     * the array of converted filter list text, and its `isConverted` flag indicates whether the original rule was
     * converted. If the rule was not converted, the original filter list text will be returned
     * @throws If the filter list is invalid or cannot be converted (if the tolerant mode is disabled)
     */
    public static convertToAdg(rawFilterList: string, tolerant = true): ConversionResult<string> {
        const conversionResult = FilterListConverter.convertToAdg(
            FilterListParser.parse(rawFilterList, { tolerant }),
            tolerant,
        );

        // If the filter list was not converted, return the original text
        if (!conversionResult.isConverted) {
            return createConversionResult(rawFilterList, false);
        }

        // Otherwise, serialize the filter list and return the result
        return createConversionResult(FilterListParser.generate(conversionResult.result), true);
    }
}
