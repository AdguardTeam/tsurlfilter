import { AdblockSyntax } from '../../utils/adblockers';
import { AgentCommentRuleParser } from './agent-rule';
import {
    type AnyCommentRule,
    CommentMarker,
    CommentRuleType,
    RuleCategory,
    type Value,
} from '../common';
import { ConfigCommentRuleParser } from './inline-config';
import { CosmeticRuleSeparatorUtils } from '../../utils/cosmetic-rule-separator';
import { HintCommentRuleParser } from './hint-rule';
import { MetadataCommentRuleParser } from './metadata';
import { PreProcessorCommentRuleParser } from './preprocessor';
import { EMPTY } from '../../utils/constants';
import { StringUtils } from '../../utils/string';
import { locRange } from '../../utils/location';
import { getParserOptions, type ParserOptions } from '../options';

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
export class CommentRuleParser {
    /**
     * Checks whether a rule is a regular comment. Regular comments are the ones that start with
     * an exclamation mark (`!`).
     *
     * @param raw Raw rule
     * @returns `true` if the rule is a regular comment, `false` otherwise
     */
    public static isRegularComment(raw: string): boolean {
        // Source may start with a whitespace, so we need to trim it first
        return raw.trim().startsWith(CommentMarker.Regular);
    }

    /**
     * Checks whether a rule is a comment.
     *
     * @param raw Raw rule
     * @returns `true` if the rule is a comment, `false` otherwise
     */
    public static isCommentRule(raw: string): boolean {
        const trimmed = raw.trim();

        // Regular comments
        if (CommentRuleParser.isRegularComment(trimmed)) {
            return true;
        }

        // Hashmark based comments
        if (trimmed.startsWith(CommentMarker.Hashmark)) {
            const result = CosmeticRuleSeparatorUtils.find(trimmed);

            // No separator
            if (result === null) {
                return true;
            }

            // Separator end index
            const { end } = result;

            // No valid selector
            if (
                !trimmed[end + 1]
                    || StringUtils.isWhitespace(trimmed[end + 1])
                    || (trimmed[end + 1] === CommentMarker.Hashmark && trimmed[end + 2] === CommentMarker.Hashmark)
            ) {
                return true;
            }
        }

        // Adblock agent comment rules
        return AgentCommentRuleParser.isAgentRule(trimmed);
    }

    /**
     * Parses a raw rule as comment.
     *
     * @param raw Raw rule
     * @param options Parser options. See {@link ParserOptions}.
     * @returns Comment AST or null (if the raw rule cannot be parsed as comment)
     */
    public static parse(raw: string, options: Partial<ParserOptions> = {}): AnyCommentRule | null {
        // Ignore non-comment rules
        if (!CommentRuleParser.isCommentRule(raw)) {
            return null;
        }

        const { baseLoc, isLocIncluded } = getParserOptions(options);
        const options2 = { isLocIncluded, baseLoc };

        // First, try to parse as non-regular comment
        const nonRegular = AgentCommentRuleParser.parse(raw, options2)
            || HintCommentRuleParser.parse(raw, options2)
            || PreProcessorCommentRuleParser.parse(raw, options2)
            || MetadataCommentRuleParser.parse(raw, options2)
            || ConfigCommentRuleParser.parse(raw, options2);

        if (nonRegular) {
            return nonRegular;
        }

        // If we are here, it means that the rule is a regular comment
        let offset = 0;

        // Skip leading whitespace (if any)
        offset = StringUtils.skipWS(raw, offset);

        // Get comment marker
        const marker: Value<CommentMarker> = {
            type: 'Value',
            value: raw[offset] === CommentMarker.Hashmark ? CommentMarker.Hashmark : CommentMarker.Regular,
        };

        if (isLocIncluded) {
            marker.loc = locRange(baseLoc, offset, offset + 1);
        }

        // Skip marker
        offset += 1;

        // Get comment text
        const text: Value = {
            type: 'Value',
            value: raw.slice(offset),
        };

        if (isLocIncluded) {
            text.loc = locRange(baseLoc, offset, raw.length);
        }

        // Regular comment rule
        const result: AnyCommentRule = {
            category: RuleCategory.Comment,
            type: CommentRuleType.CommentRule,
            raws: {
                text: raw,
            },
            // TODO: Change syntax when hashmark is used?
            syntax: AdblockSyntax.Common,
            marker,
            text,
        };

        if (isLocIncluded) {
            result.loc = locRange(baseLoc, 0, raw.length);
        }

        return result;
    }

    /**
     * Converts a comment AST to a string.
     *
     * @param ast Comment AST
     * @returns Raw string
     */
    public static generate(ast: AnyCommentRule): string {
        let result = EMPTY;

        // Generate based on the rule type
        switch (ast.type) {
            case CommentRuleType.AgentCommentRule:
                return AgentCommentRuleParser.generate(ast);

            case CommentRuleType.HintCommentRule:
                return HintCommentRuleParser.generate(ast);

            case CommentRuleType.PreProcessorCommentRule:
                return PreProcessorCommentRuleParser.generate(ast);

            case CommentRuleType.MetadataCommentRule:
                return MetadataCommentRuleParser.generate(ast);

            case CommentRuleType.ConfigCommentRule:
                return ConfigCommentRuleParser.generate(ast);

            // Regular comment rule
            case CommentRuleType.CommentRule:
                result += ast.marker.value;
                result += ast.text.value;
                return result;

            default:
                throw new Error('Unknown comment rule type');
        }
    }
}
