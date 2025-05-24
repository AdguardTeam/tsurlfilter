/**
 * @file Rule converter for raw rules
 *
 * Technically, this is a wrapper around `RuleConverter` that works with nodes instead of strings.
 */

import { createConversionResult, type ConversionResult } from './base-interfaces/conversion-result.js';
import { RuleParser } from '../parser/rule-parser.js';
import { RuleConverter } from './rule.js';
import { BaseConverter } from './base-interfaces/base-converter.js';
import { RuleGenerator } from '../generator/index.js';

/**
 * Adblock filtering rule converter class.
 *
 * You can use this class to convert string-based adblock rules, since most of the converters work with nodes.
 * This class just provides an extra layer on top of the {@link RuleConverter} and calls the parser/serializer
 * before/after the conversion internally.
 *
 * @todo Implement `convertToUbo` and `convertToAbp`
 */
export class RawRuleConverter extends BaseConverter {
    /**
     * Converts an adblock filtering rule to AdGuard format, if possible.
     *
     * @param rawRule Raw rule text to convert
     * @returns An object which follows the {@link ConversionResult} interface. Its `result` property contains
     * the array of converted rule texts, and its `isConverted` flag indicates whether the original rule was converted.
     * If the rule was not converted, the original rule text will be returned
     * @throws If the rule is invalid or cannot be converted
     */
    public static convertToAdg(rawRule: string): ConversionResult<string, string[]> {
        const conversionResult = RuleConverter.convertToAdg(RuleParser.parse(rawRule));

        // If the rule was not converted, return the original rule text
        if (!conversionResult.isConverted) {
            return createConversionResult([rawRule], false);
        }

        // Otherwise, serialize the converted rule nodes
        return createConversionResult(conversionResult.result.map(RuleGenerator.generate), true);
    }
}
