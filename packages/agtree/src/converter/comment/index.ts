/**
 * @file Comment rule converter
 */

import { type AnyCommentRule, CommentMarker, CommentRuleType } from '../../parser/common';
import { SPACE } from '../../utils/constants';
import { RuleConverterBase } from '../base-interfaces/rule-converter-base';
import { clone } from '../../utils/clone';
import { createNodeConversionResult, type NodeConversionResult } from '../base-interfaces/conversion-result';

/**
 * Comment rule converter class
 *
 * @todo Implement `convertToUbo` and `convertToAbp`
 */
export class CommentRuleConverter extends RuleConverterBase {
    /**
     * Converts a comment rule to AdGuard format, if possible.
     *
     * @param rule Rule node to convert
     * @returns An object which follows the {@link NodeConversionResult} interface. Its `result` property contains
     * the array of converted rule nodes, and its `isConverted` flag indicates whether the original rule was converted.
     * If the rule was not converted, the result array will contain the original node with the same object reference
     * @throws If the rule is invalid or cannot be converted
     */
    public static convertToAdg(rule: AnyCommentRule): NodeConversionResult<AnyCommentRule> {
        // TODO: Add support for other comment types, if needed
        // Main task is # -> ! conversion
        switch (rule.type) {
            case CommentRuleType.CommentRule:
                // Check if the rule needs to be converted
                if (rule.type === CommentRuleType.CommentRule && rule.marker.value === CommentMarker.Hashmark) {
                    // Add a ! to the beginning of the comment
                    // TODO: Replace with custom clone method
                    const ruleClone = clone(rule);

                    ruleClone.marker.value = CommentMarker.Regular;

                    // Add the hashmark to the beginning of the comment text
                    ruleClone.text.value = `${SPACE}${CommentMarker.Hashmark}${ruleClone.text.value}`;

                    return createNodeConversionResult([ruleClone], true);
                }

                return createNodeConversionResult([rule], false);

            // Leave any other comment rule as is
            default:
                return createNodeConversionResult([rule], false);
        }
    }
}
