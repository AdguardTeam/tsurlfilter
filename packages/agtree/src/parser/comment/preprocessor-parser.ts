/**
 * Pre-processor directives
 *
 * @see {@link https://kb.adguard.com/en/general/how-to-create-your-own-ad-filters#pre-processor-directives}
 * @see {@link https://github.com/gorhill/uBlock/wiki/Static-filter-syntax#pre-parsing-directives}
 */

import { AdblockSyntax } from '../../utils/adblockers';
import {
    CLOSE_PARENTHESIS,
    COMMA,
    HASHMARK,
    IF,
    INCLUDE,
    OPEN_PARENTHESIS,
    PREPROCESSOR_MARKER,
    PREPROCESSOR_MARKER_LEN,
    PREPROCESSOR_SEPARATOR,
    SAFARI_CB_AFFINITY,
} from '../../utils/constants';
import { StringUtils } from '../../utils/string';
import type { AnyExpressionNode, PreProcessorCommentRule, Value } from '../../nodes';
import { CommentRuleType, RuleCategory } from '../../nodes';
import { LogicalExpressionParser } from '../misc/logical-expression-parser';
import { AdblockSyntaxError } from '../../errors/adblock-syntax-error';
import { ParameterListParser } from '../misc/parameter-list-parser';
import { defaultParserOptions } from '../options';
import { BaseParser } from '../base-parser';
import { ValueParser } from '../misc/value-parser';

/**
 * `PreProcessorParser` is responsible for parsing preprocessor rules.
 * Pre-processor comments are special comments that are used to control the behavior of the filter list processor.
 * Please note that this parser only handles general syntax for now, and does not validate the parameters at
 * the parsing stage.
 *
 * @example
 * If your rule is
 * ```adblock
 * !#if (adguard)
 * ```
 * then the directive's name is `if` and its value is `(adguard)`, but the parameter list
 * is not parsed / validated further.
 * @see {@link https://kb.adguard.com/en/general/how-to-create-your-own-ad-filters#pre-processor-directives}
 * @see {@link https://github.com/gorhill/uBlock/wiki/Static-filter-syntax#pre-parsing-directives}
 */
export class PreProcessorCommentParser extends BaseParser {
    /**
     * Determines whether the rule is a pre-processor rule.
     *
     * @param raw Raw rule
     * @returns `true` if the rule is a pre-processor rule, `false` otherwise
     */
    public static isPreProcessorRule(raw: string): boolean {
        const trimmed = raw.trim();

        // Avoid this case: !##... (commonly used in AdGuard filters)
        return trimmed.startsWith(PREPROCESSOR_MARKER) && trimmed[PREPROCESSOR_MARKER_LEN] !== HASHMARK;
    }

    /**
     * Parses a raw rule as a pre-processor comment.
     *
     * @param raw Raw input to parse.
     * @param options Global parser options.
     * @param baseOffset Starting offset of the input. Node locations are calculated relative to this offset.
     * @returns
     * Pre-processor comment AST or null (if the raw rule cannot be parsed as a pre-processor comment)
     */
    public static parse(raw: string, options = defaultParserOptions, baseOffset = 0): PreProcessorCommentRule | null {
        // Ignore non-pre-processor rules
        if (!PreProcessorCommentParser.isPreProcessorRule(raw)) {
            return null;
        }

        let offset = 0;

        // Ignore whitespace characters before the rule (if any)
        offset = StringUtils.skipWS(raw, offset);

        // Ignore the pre-processor marker
        offset += PREPROCESSOR_MARKER_LEN;

        // Ignore whitespace characters after the pre-processor marker (if any)
        // Note: this is incorrect according to the spec, but we do it for tolerance
        offset = StringUtils.skipWS(raw, offset);

        // Directive name should start at this offset, so we save this offset now
        const nameStart = offset;

        // Consume directive name, so parse the sequence until the first
        // whitespace / opening parenthesis / end of string
        while (offset < raw.length) {
            const ch = raw[offset];

            if (ch === PREPROCESSOR_SEPARATOR || ch === OPEN_PARENTHESIS) {
                break;
            }

            offset += 1;
        }

        // Save name end offset
        const nameEnd = offset;

        // Create name node
        const name = ValueParser.parse(raw.slice(nameStart, nameEnd), options, baseOffset + nameStart);

        // Ignore whitespace characters after the directive name (if any)
        // Note: this may incorrect according to the spec, but we do it for tolerance
        offset = StringUtils.skipWS(raw, offset);

        // If the directive name is "safari_cb_affinity", then we have a special case
        if (name.value === SAFARI_CB_AFFINITY) {
            // Throw error if there are spaces after the directive name
            if (offset > nameEnd) {
                throw new AdblockSyntaxError(
                    `Unexpected whitespace after "${SAFARI_CB_AFFINITY}" directive name`,
                    baseOffset + nameEnd,
                    baseOffset + offset,
                );
            }

            // safari_cb_affinity directive optionally accepts a parameter list
            // So at this point we should check if there are parameters or not
            // (cb_affinity directive followed by an opening parenthesis or if we
            // skip the whitespace we reach the end of the string)
            if (StringUtils.skipWS(raw, offset) !== raw.length) {
                if (raw[offset] !== OPEN_PARENTHESIS) {
                    throw new AdblockSyntaxError(
                        `Unexpected character '${raw[offset]}' after '${SAFARI_CB_AFFINITY}' directive name`,
                        baseOffset + offset,
                        baseOffset + offset + 1,
                    );
                }

                // If we have parameters, then we should parse them
                // Note: we don't validate the parameters at this stage

                // Ignore opening parenthesis
                offset += 1;

                // Save parameter list start offset
                const parameterListStart = offset;

                // Check for closing parenthesis
                const closingParenthesesIndex = StringUtils.skipWSBack(raw);

                if (closingParenthesesIndex === -1 || raw[closingParenthesesIndex] !== CLOSE_PARENTHESIS) {
                    throw new AdblockSyntaxError(
                        `Missing closing parenthesis for '${SAFARI_CB_AFFINITY}' directive`,
                        baseOffset + offset,
                        baseOffset + raw.length,
                    );
                }

                // Save parameter list end offset
                const parameterListEnd = closingParenthesesIndex;

                // Parse parameters between the opening and closing parentheses
                const result: PreProcessorCommentRule = {
                    type: CommentRuleType.PreProcessorCommentRule,
                    category: RuleCategory.Comment,
                    syntax: AdblockSyntax.Adg,
                    name,
                    // comma separated list of parameters
                    params: ParameterListParser.parse(
                        raw.slice(parameterListStart, parameterListEnd),
                        options,
                        baseOffset + parameterListStart,
                        COMMA,
                    ),
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

        // If we reached the end of the string, then we have a directive without parameters
        // (e.g. "!#safari_cb_affinity" or "!#endif")
        // No need to continue parsing in this case.
        if (offset === raw.length) {
            // Throw error if the directive name is "if" or "include", because these directives
            // should have parameters
            if (name.value === IF || name.value === INCLUDE) {
                throw new AdblockSyntaxError(
                    `Directive "${name.value}" requires parameters`,
                    baseOffset,
                    baseOffset + raw.length,
                );
            }

            const result: PreProcessorCommentRule = {
                type: CommentRuleType.PreProcessorCommentRule,
                category: RuleCategory.Comment,
                syntax: AdblockSyntax.Common,
                name,
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

        // Get start and end offsets of the directive parameters
        const paramsStart = offset;
        const paramsEnd = StringUtils.skipWSBack(raw) + 1;

        // Prepare parameters node
        let params: Value | AnyExpressionNode;

        // Parse parameters. Handle "if" and "safari_cb_affinity" directives
        // separately.
        if (name.value === IF) {
            params = LogicalExpressionParser.parse(
                raw.slice(paramsStart, paramsEnd),
                options,
                baseOffset + paramsStart,
            );
        } else {
            params = ValueParser.parse(raw.slice(paramsStart, paramsEnd), options, baseOffset + paramsStart);
        }

        const result: PreProcessorCommentRule = {
            type: CommentRuleType.PreProcessorCommentRule,
            category: RuleCategory.Comment,
            syntax: AdblockSyntax.Common,
            name,
            params,
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
