/**
 * @file AGLint configuration comments. Inspired by ESLint inline configuration comments.
 * @see {@link https://eslint.org/docs/latest/user-guide/configuring/rules#using-configuration-comments}
 */

import { AdblockSyntax } from '../../utils/adblockers';
import { AGLINT_COMMAND_PREFIX, AGLINT_CONFIG_COMMENT_MARKER, COMMA } from '../../utils/constants';
import {
    CommentMarker,
    CommentRuleType,
    type ConfigCommentRule,
    type ParameterList,
    RuleCategory,
    type Value,
    type ConfigNode,
} from '../../nodes';
import { StringUtils } from '../../utils/string';
import { ParameterListParser } from '../misc/parameter-list-parser';
import { defaultParserOptions } from '../options';
import { BaseParser } from '../base-parser';
import { ValueParser } from '../misc/value-parser';

/**
 * Helper function to parse JSON with unquoted keys.
 * Adds quotes to keys that are not already quoted.
 *
 * The main reason of adding this function is to avoid using JSON5
 * which is not maintained and causes issues in aglint-cli.
 *
 * @param jsonString JSON string to parse.
 *
 * @returns Parsed JSON object.
 *
 * @throws If the JSON string cannot be parsed.
 */
function parseJsonWithUnquotedKeys(jsonString: string): Record<string, unknown> {
    // Add quotes to unquoted keys
    // This regex matches property names that are not already quoted
    const quotedJsonString = jsonString.replace(
        /(\s*)([\w$][\w\d$]*)(\s*:)/g,
        '$1"$2"$3'
    );

    try {
        return JSON.parse(`{${quotedJsonString}}`);
    } catch (error) {
        throw new Error(`Failed to parse JSON: ${error instanceof Error ? error.message : String(error)}`);
    }
}

/**
 * `ConfigCommentParser` is responsible for parsing inline AGLint configuration rules.
 * Generally, the idea is inspired by ESLint inline configuration comments.
 *
 * @see {@link https://eslint.org/docs/latest/user-guide/configuring/rules#using-configuration-comments}
 */
export class ConfigCommentParser extends BaseParser {
    /**
     * Checks if the raw rule is an inline configuration comment rule.
     *
     * @param raw Raw rule
     * @returns `true` if the rule is an inline configuration comment rule, otherwise `false`.
     */
    public static isConfigComment(raw: string): boolean {
        const trimmed = raw.trim();

        if (trimmed[0] === CommentMarker.Regular || trimmed[0] === CommentMarker.Hashmark) {
            // Skip comment marker and trim comment text (it is necessary because of "!     something")
            const text = raw.slice(1).trim();

            // The code below is "not pretty", but it runs fast, which is necessary, since it will run on EVERY comment
            // The essence of the indicator is that the control comment always starts with the "aglint" prefix
            return (
                (text[0] === 'a' || text[0] === 'A')
                && (text[1] === 'g' || text[1] === 'G')
                && (text[2] === 'l' || text[2] === 'L')
                && (text[3] === 'i' || text[3] === 'I')
                && (text[4] === 'n' || text[4] === 'N')
                && (text[5] === 't' || text[5] === 'T')
            );
        }

        return false;
    }

    /**
     * Parses a raw rule as an inline configuration comment.
     *
     * @param raw Raw input to parse.
     * @param options Global parser options.
     * @param baseOffset Starting offset of the input. Node locations are calculated relative to this offset.
     * @returns
     * Inline configuration comment AST or null (if the raw rule cannot be parsed as configuration comment)
     */
    public static parse(raw: string, options = defaultParserOptions, baseOffset = 0): ConfigCommentRule | null {
        if (!ConfigCommentParser.isConfigComment(raw)) {
            return null;
        }

        let offset = 0;

        // Skip leading whitespace (if any)
        offset = StringUtils.skipWS(raw, offset);

        // Get comment marker
        const marker = ValueParser.parse(raw[offset], options, baseOffset + offset);

        // Skip marker
        offset += 1;

        // Skip whitespace (if any)
        offset = StringUtils.skipWS(raw, offset);

        // Save the command start position
        const commandStart = offset;

        // Get comment text, for example: "aglint-disable-next-line"
        offset = StringUtils.findNextWhitespaceCharacter(raw, offset);

        const command = ValueParser.parse(raw.slice(commandStart, offset), options, baseOffset + commandStart);

        // Skip whitespace after command
        offset = StringUtils.skipWS(raw, offset);

        // Get comment (if any)
        const commentStart = raw.indexOf(AGLINT_CONFIG_COMMENT_MARKER, offset);
        const commentEnd = commentStart !== -1 ? StringUtils.skipWSBack(raw) + 1 : -1;

        let comment: Value | undefined;

        // Check if there is a comment
        if (commentStart !== -1) {
            comment = ValueParser.parse(raw.slice(commentStart, commentEnd), options, baseOffset + commentStart);
        }

        // Get parameter
        const paramsStart = offset;
        const paramsEnd = commentStart !== -1
            ? StringUtils.skipWSBack(raw, commentStart - 1) + 1
            : StringUtils.skipWSBack(raw) + 1;

        let params: ConfigNode | ParameterList | undefined;

        // `! aglint ...` config comment
        if (command.value === AGLINT_COMMAND_PREFIX) {
            params = {
                type: 'ConfigNode',
                // We need to parse JSON with potentially unquoted keys
                // Using a custom helper function instead of JSON5
                value: parseJsonWithUnquotedKeys(raw.slice(paramsStart, paramsEnd)),
            };

            if (options.isLocIncluded) {
                params.start = paramsStart;
                params.end = paramsEnd;
            }

            // Throw error for empty config
            if (Object.keys(params.value).length === 0) {
                throw new Error('Empty AGLint config');
            }
        } else if (paramsStart < paramsEnd) {
            params = ParameterListParser.parse(
                raw.slice(paramsStart, paramsEnd),
                options,
                baseOffset + paramsStart,
                COMMA,
            );
        }

        const result: ConfigCommentRule = {
            type: CommentRuleType.ConfigCommentRule,
            category: RuleCategory.Comment,
            syntax: AdblockSyntax.Common,
            marker,
            command,
            params,
            comment,
        };

        if (options.includeRaws) {
            result.raws = {
                text: raw,
            };
        }

        if (options.isLocIncluded) {
            result.start = baseOffset;
            result.end = baseOffset + raw.length;
        }

        return result;
    }
}
