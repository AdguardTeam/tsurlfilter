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
 * `CommentParser` is responsible for parsing any comment-like adblock rules.
 *
 * @example
 * Example rules:
 *  - Adblock agent rules:
 *      - ```adblock
 *        [AdGuard]
 *        ```
 *      - ```adblock
 *        [Adblock Plus 2.0]
 *        ```
 *      - etc.
 *  - AdGuard hint rules:
 *      - ```adblock
 *        !+ NOT_OPTIMIZED
 *        ```
 *      - ```adblock
 *        !+ NOT_OPTIMIZED PLATFORM(windows)
 *        ```
 *      - etc.
 *  - Pre-processor rules:
 *      - ```adblock
 *        !#if (adguard)
 *        ```
 *      - ```adblock
 *        !#endif
 *        ```
 *      - etc.
 *  - Metadata rules:
 *      - ```adblock
 *        ! Title: My List
 *        ```
 *      - ```adblock
 *        ! Version: 2.0.150
 *        ```
 *      - etc.
 *  - AGLint inline config rules:
 *      - ```adblock
 *        ! aglint-enable some-rule
 *        ```
 *      - ```adblock
 *        ! aglint-disable some-rule
 *        ```
 *      - etc.
 *  - Simple comments:
 *      - Regular version:
 *        ```adblock
 *        ! This is just a comment
 *        ```
 *      - uBlock Origin / "hostlist" version:
 *        ```adblock
 *        # This is just a comment
 *        ```
 *      - etc.
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
