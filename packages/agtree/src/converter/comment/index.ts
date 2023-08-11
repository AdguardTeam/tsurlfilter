/**
 * @file Comment rule converter
 */

import cloneDeep from 'clone-deep';

import { type AnyCommentRule, CommentMarker, CommentRuleType } from '../../parser/common';
import { SPACE } from '../../utils/constants';
import { RuleConverterBase } from '../base-interfaces/rule-converter-base';

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
     * @returns Array of converted rule nodes
     * @throws If the rule is invalid or cannot be converted
     */
    public static convertToAdg(rule: AnyCommentRule): AnyCommentRule[] {
        // Clone the provided AST node to avoid side effects
        const ruleNode = cloneDeep(rule);

        // TODO: Add support for other comment types, if needed
        // Main task is # -> ! conversion
        switch (ruleNode.type) {
            case CommentRuleType.CommentRule:
                // 'Comment' uBO style comments
                if (
                    ruleNode.type === CommentRuleType.CommentRule
                    && ruleNode.marker.value === CommentMarker.Hashmark
                ) {
                    ruleNode.marker.value = CommentMarker.Regular;

                    // Add the hashmark to the beginning of the comment
                    ruleNode.text.value = `${SPACE}${CommentMarker.Hashmark}${ruleNode.text.value}`;
                }

                return [ruleNode];

            // Leave any other comment rule as is
            default:
                return [ruleNode];
        }
    }
}
