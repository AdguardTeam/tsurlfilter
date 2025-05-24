/**
 * @file AGLint configuration comments. Inspired by ESLint inline configuration comments.
 * @see {@link https://eslint.org/docs/latest/user-guide/configuring/rules#using-configuration-comments}
 */

import JSON5 from 'json5';

import { AdblockSyntax } from '../../utils/adblockers.js';
import { AGLINT_COMMAND_PREFIX, AGLINT_CONFIG_COMMENT_MARKER, COMMA } from '../../utils/constants.js';
import {
    CommentMarker,
    CommentRuleType,
    type ConfigCommentRule,
    type ParameterList,
    RuleCategory,
    type Value,
    type ConfigNode,
} from '../../nodes/index.js';
import { StringUtils } from '../../utils/string.js';
import { ParameterListParser } from '../misc/parameter-list-parser.js';
import { defaultParserOptions } from '../options.js';
import { BaseParser } from '../base-parser.js';
import { ValueParser } from '../misc/value-parser.js';

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
                // It is necessary to use JSON5.parse instead of JSON.parse because JSON5 allows unquoted keys.
                // But don't forget to add { } to the beginning and end of the string,
                // otherwise JSON5 will not be able to parse it.
                // TODO: Better solution? ESLint uses "levn" package for parsing these comments.
                value: JSON5.parse(`{${raw.slice(paramsStart, paramsEnd)}}`),
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
