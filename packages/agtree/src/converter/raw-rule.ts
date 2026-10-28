/**
 * @file Rule converter for raw rules.
 *
 * Technically, this is a wrapper around `RuleConverter` that works with nodes instead of strings.
 */

import { RuleParserPipeline } from '../ast-builder/rule-parser';
import { AdblockSyntaxError } from '../errors/adblock-syntax-error';
import { RuleGenerator } from '../generator';
import { type AnyRule } from '../nodes';

import { BaseConverter } from './base-interfaces/base-converter';
import { type ConversionResult, createConversionResult } from './base-interfaces/conversion-result';
import { CONVERTER_PARSE_OPTIONS, CONVERTER_PARSE_OPTIONS_RAW_HTML_BODIES } from './parse-options';
import { RuleConverter } from './rule';

/**
 * Module-shared pipeline: reused across every `convertToAdg` call so filter-list
 * preparation does not allocate a tokenizer + Int32Array context per line.
 */
const sharedRuleParser = new RuleParserPipeline();

/**
 * Adblock filtering rule converter class.
 *
 * You can use this class to convert string-based adblock rules, since most of the converters work with nodes.
 * This class just provides an extra layer on top of the {@link RuleConverter} and calls the parser/serializer
 * before/after the conversion internally.
 *
 * @todo Implement `convertToUbo` and `convertToAbp`.
 */
export class RawRuleConverter extends BaseConverter {
    /**
     * Converts an adblock filtering rule to AdGuard format, if possible.
     *
     * @param rawRule Raw rule text to convert.
     *
     * @returns An object which follows the {@link ConversionResult} interface. Its `result` property contains
     * the array of converted rule texts, and its `isConverted` flag indicates whether the original rule was converted.
     * If the rule was not converted, the original rule text will be returned.
     *
     * @throws If the rule is invalid or cannot be converted.
     */
    public static convertToAdg(rawRule: string): ConversionResult<string, string[]> {
        let ruleNode: AnyRule;

        try {
            ruleNode = sharedRuleParser.parse(rawRule, CONVERTER_PARSE_OPTIONS);
        } catch (error) {
            // The parser rejects HTML filtering bodies it cannot parse, but the
            // converter keeps such rules as-is when they contain special
            // selectors. Re-parse with raw HTML filtering bodies so the
            // converter's tolerant fallback can run. Only HTML filtering body
            // parsing changes, so other rules fail again and the original
            // error is rethrown.
            if (!(error instanceof AdblockSyntaxError)) {
                throw error;
            }

            try {
                ruleNode = sharedRuleParser.parse(rawRule, CONVERTER_PARSE_OPTIONS_RAW_HTML_BODIES);
            } catch {
                throw error;
            }
        }

        const conversionResult = RuleConverter.convertToAdg(ruleNode);

        // If the rule was not converted, return the original rule text
        if (!conversionResult.isConverted) {
            return createConversionResult([rawRule], false);
        }

        // Otherwise, serialize the converted rule nodes
        return createConversionResult(conversionResult.result.map(RuleGenerator.generate), true);
    }
}
