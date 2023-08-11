import { AdblockSyntax } from '../../utils/adblockers';
import { AgentCommentRuleParser } from './agent-rule';
import {
    type AnyCommentRule,
    CommentMarker,
    CommentRuleType,
    type Location,
    RuleCategory,
    type Value,
    defaultLocation,
} from '../common';
import { ConfigCommentRuleParser } from './inline-config';
import { CosmeticRuleSeparatorUtils } from '../../utils/cosmetic-rule-separator';
import { HintCommentRuleParser } from './hint-rule';
import { MetadataCommentRuleParser } from './metadata';
import { PreProcessorCommentRuleParser } from './preprocessor';
import { EMPTY } from '../../utils/constants';
import { StringUtils } from '../../utils/string';
import { locRange } from '../../utils/location';

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
     * @param loc Base location
     * @returns Comment AST or null (if the raw rule cannot be parsed as comment)
     */
    public static parse(raw: string, loc: Location = defaultLocation): AnyCommentRule | null {
        // Ignore non-comment rules
        if (!CommentRuleParser.isCommentRule(raw)) {
            return null;
        }

        // First, try to parse as non-regular comment
        const nonRegular = AgentCommentRuleParser.parse(raw, loc)
            || HintCommentRuleParser.parse(raw, loc)
            || PreProcessorCommentRuleParser.parse(raw, loc)
            || MetadataCommentRuleParser.parse(raw, loc)
            || ConfigCommentRuleParser.parse(raw, loc);

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
            loc: locRange(loc, offset, offset + 1),
            value: raw[offset] === CommentMarker.Hashmark ? CommentMarker.Hashmark : CommentMarker.Regular,
        };

        // Skip marker
        offset += 1;

        // Get comment text
        const text: Value = {
            type: 'Value',
            loc: locRange(loc, offset, raw.length),
            value: raw.slice(offset),
        };

        // Regular comment rule
        return {
            category: RuleCategory.Comment,
            type: CommentRuleType.CommentRule,
            loc: locRange(loc, 0, raw.length),
            raws: {
                text: raw,
            },
            // TODO: Change syntax when hashmark is used?
            syntax: AdblockSyntax.Common,
            marker,
            text,
        };
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
