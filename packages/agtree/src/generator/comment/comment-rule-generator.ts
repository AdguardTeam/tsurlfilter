/* eslint-disable no-param-reassign */
import { type AnyCommentRule, CommentRuleType } from '../../nodes';
import { BaseGenerator } from '../base-generator';
import { AgentCommentGenerator } from './agent-comment-generator';
import { HintCommentGenerator } from './hint-comment-generator';
import { PreProcessorCommentGenerator } from './pre-processor-comment-generator';
import { MetadataCommentGenerator } from './metadata-comment-generator';
import { ConfigCommentGenerator } from './config-comment-generator';
import { SimpleCommentGenerator } from './simple-comment-generator';

/**
 * `CommentRuleGenerator` is responsible for generating any comment-like adblock rules.
 */
export class CommentRuleGenerator extends BaseGenerator {
    /**
     * Converts a comment rule node to a string.
     *
     * @param node Comment rule node
     * @returns Raw string
     */
    public static generate(node: AnyCommentRule): string {
        switch (node.type) {
            case CommentRuleType.AgentCommentRule:
                return AgentCommentGenerator.generate(node);

            case CommentRuleType.HintCommentRule:
                return HintCommentGenerator.generate(node);

            case CommentRuleType.PreProcessorCommentRule:
                return PreProcessorCommentGenerator.generate(node);

            case CommentRuleType.MetadataCommentRule:
                return MetadataCommentGenerator.generate(node);

            case CommentRuleType.ConfigCommentRule:
                return ConfigCommentGenerator.generate(node);

            case CommentRuleType.CommentRule:
                return SimpleCommentGenerator.generate(node);

            default:
                throw new Error('Unknown comment rule type');
        }
    }
}
