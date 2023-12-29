/**
 * @file AGLint configuration comments. Inspired by ESLint inline configuration comments.
 * @see {@link https://eslint.org/docs/latest/user-guide/configuring/rules#using-configuration-comments}
 */

import JSON5 from 'json5';

import { AdblockSyntax } from '../../utils/adblockers';
import {
    AGLINT_COMMAND_PREFIX,
    AGLINT_CONFIG_COMMENT_MARKER,
    COMMA,
    EMPTY,
    SPACE,
} from '../../utils/constants';
import {
    CommentMarker,
    CommentRuleType,
    type ConfigCommentRule,
    type ParameterList,
    RuleCategory,
    type Value,
} from '../common';
import { StringUtils } from '../../utils/string';
import { locRange, shiftLoc } from '../../utils/location';
import { ParameterListParser } from '../misc/parameter-list';
import { getParserOptions, type ParserOptions } from '../options';

/**
 * `ConfigCommentParser` is responsible for parsing inline AGLint configuration rules.
 * Generally, the idea is inspired by ESLint inline configuration comments.
 *
 * @see {@link https://eslint.org/docs/latest/user-guide/configuring/rules#using-configuration-comments}
 */
export class ConfigCommentRuleParser {
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
     * @param raw Raw rule
     * @param options Parser options. See {@link ParserOptions}.
     * @returns
     * Inline configuration comment AST or null (if the raw rule cannot be parsed as configuration comment)
     */
    public static parse(raw: string, options: Partial<ParserOptions> = {}): ConfigCommentRule | null {
        const { baseLoc, isLocIncluded } = getParserOptions(options);

        if (!ConfigCommentRuleParser.isConfigComment(raw)) {
            return null;
        }

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

        // Skip whitespace (if any)
        offset = StringUtils.skipWS(raw, offset);

        // Save the command start position
        const commandStart = offset;

        // Get comment text, for example: "aglint-disable-next-line"
        offset = StringUtils.findNextWhitespaceCharacter(raw, offset);

        const command: Value = {
            type: 'Value',
            value: raw.substring(commandStart, offset),
        };

        if (isLocIncluded) {
            command.loc = locRange(baseLoc, commandStart, offset);
        }

        // Skip whitespace after command
        offset = StringUtils.skipWS(raw, offset);

        // Get comment (if any)
        const commentStart = raw.indexOf(AGLINT_CONFIG_COMMENT_MARKER, offset);
        const commentEnd = commentStart !== -1 ? StringUtils.skipWSBack(raw) + 1 : -1;

        let comment: Value | undefined;

        // Check if there is a comment
        if (commentStart !== -1) {
            comment = {
                type: 'Value',
                value: raw.substring(commentStart, commentEnd),
            };

            if (isLocIncluded) {
                comment.loc = locRange(baseLoc, commentStart, commentEnd);
            }
        }

        // Get parameter
        const paramsStart = offset;
        const paramsEnd = commentStart !== -1
            ? StringUtils.skipWSBack(raw, commentStart - 1) + 1
            : StringUtils.skipWSBack(raw) + 1;

        let params: Value<object> | ParameterList | undefined;

        // ! aglint config
        if (command.value === AGLINT_COMMAND_PREFIX) {
            params = {
                type: 'Value',
                // It is necessary to use JSON5.parse instead of JSON.parse
                // because JSON5 allows unquoted keys.
                // But don't forget to add { } to the beginning and end of the string,
                // otherwise JSON5 will not be able to parse it.
                // TODO: Better solution? ESLint uses "levn" package for parsing these comments.
                value: JSON5.parse(`{${raw.substring(paramsStart, paramsEnd)}}`),
            };

            if (isLocIncluded) {
                params.loc = locRange(baseLoc, paramsStart, paramsEnd);
            }

            // Throw error for empty config
            if (Object.keys(params.value).length === 0) {
                throw new Error('Empty AGLint config');
            }
        } else if (paramsStart < paramsEnd) {
            params = ParameterListParser.parse(
                raw.substring(paramsStart, paramsEnd),
                {
                    isLocIncluded,
                    separator: COMMA,
                    baseLoc: shiftLoc(baseLoc, paramsStart),
                },
            );
        }

        const result: ConfigCommentRule = {
            type: CommentRuleType.ConfigCommentRule,
            raws: {
                text: raw,
            },
            category: RuleCategory.Comment,
            syntax: AdblockSyntax.Common,
            marker,
            command,
            params,
            comment,
        };

        if (isLocIncluded) {
            result.loc = locRange(baseLoc, 0, raw.length);
        }

        return result;
    }

    /**
     * Converts an inline configuration comment AST to a string.
     *
     * @param ast Inline configuration comment AST
     * @returns Raw string
     */
    public static generate(ast: ConfigCommentRule): string {
        let result = EMPTY;

        result += ast.marker.value;
        result += SPACE;
        result += ast.command.value;

        if (ast.params) {
            result += SPACE;

            if (ast.params.type === 'ParameterList') {
                result += ParameterListParser.generate(ast.params, COMMA);
            } else {
                // Trim JSON boundaries
                result += JSON.stringify(ast.params.value).slice(1, -1).trim();
            }
        }

        // Add comment within the config comment
        if (ast.comment) {
            result += SPACE;
            result += ast.comment.value;
        }

        return result;
    }
}
