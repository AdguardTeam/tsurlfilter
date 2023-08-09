/**
 * @file Comment rule converter
 */

import cloneDeep from 'clone-deep';
import { AnyCommentRule, CommentMarker, CommentRuleType } from '../../parser/common';
import { SPACE } from '../../utils/constants';
import { RuleConverterBase } from '../base-interfaces/rule-converter-base';

/**
 * Comment rule converter class
 *
 * @todo Implement convertToUbo and convertToAbp
 */
export class CommentRuleConverter extends RuleConverterBase {
    /**
     * Convert a comment rule to AdGuard format
     *
     * @param rule Rule to convert, can be a string or an AST
     * @returns Array of converted rules ASTs
     * @throws If the rule is invalid or incompatible
     */
    public static convertToAdg(rule: AnyCommentRule): AnyCommentRule[] {
        // Clone the provided AST node to avoid side effects
        const ruleNode = cloneDeep(rule);

        // TODO: Support other comment types, if needed
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
