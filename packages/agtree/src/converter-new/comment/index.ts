/**
 * @file Comment rule converter.
 */

import { type AnyCommentRule, CommentMarker, CommentRuleType } from '../../nodes-new';
import { clone } from '../../utils/clone';
import { SPACE } from '../../utils/constants';
import { createNodeConversionResult, type NodeConversionResult } from '../base-interfaces/conversion-result';
import { RuleConverterBase } from '../base-interfaces/rule-converter-base';

/**
 * Comment rule converter class.
 *
 * @todo Implement `convertToUbo` and `convertToAbp`.
 */
export class CommentRuleConverter extends RuleConverterBase {
    /**
     * Converts a comment rule to AdGuard format, if possible.
     *
     * @param rule Rule node to convert.
     *
     * @returns An object which follows the {@link NodeConversionResult} interface. Its `result` property contains
     * the array of converted rule nodes, and its `isConverted` flag indicates whether the original rule was converted.
     * If the rule was not converted, the result array will contain the original node with the same object reference.
     *
     * @throws If the rule is invalid or cannot be converted.
     */
    public static convertToAdg(rule: AnyCommentRule): NodeConversionResult<AnyCommentRule> {
        // TODO: Add support for other comment types, if needed
        // Main task is # -> ! conversion
        switch (rule.type) {
            case CommentRuleType.CommentRule:
                // Check if the rule needs to be converted
                if (rule.type === CommentRuleType.CommentRule && rule.marker.value === CommentMarker.Hashmark) {
                    // Convert #-style comment to !-style comment
                    // TODO: Replace with custom clone method
                    const ruleClone = clone(rule);

                    ruleClone.marker.value = CommentMarker.Regular;

                    // The `#` marker is kept as part of the visible text, so the
                    // converted rule reads e.g. `! # comment`. Reattach the marker
                    // together with its original marker-to-text spacing (preserved
                    // on the node, defaulting to a single space) instead of guessing
                    // it from the text content — `#comment` and `# comment` both
                    // expose text `comment` and must stay distinguishable.
                    const originalSpacing = rule.markerSpacing ?? SPACE;
                    ruleClone.text.value = `${CommentMarker.Hashmark}${originalSpacing}${rule.text.value}`;

                    // The converted `!` marker uses the default single-space
                    // spacing, so drop any preserved (non-default) spacing.
                    delete ruleClone.markerSpacing;

                    return createNodeConversionResult([ruleClone], true);
                }

                return createNodeConversionResult([rule], false);

            // Leave any other comment rule as is
            default:
                return createNodeConversionResult([rule], false);
        }
    }
}
