import { CLOSE_SQUARE_BRACKET, OPEN_SQUARE_BRACKET, SEMICOLON } from '../../utils/constants.js';
import { StringUtils } from '../../utils/string.js';
import { type AgentCommentRule, CommentRuleType, RuleCategory } from '../../nodes/index.js';
import { AgentParser } from './agent-parser.js';
import { AdblockSyntaxError } from '../../errors/adblock-syntax-error.js';
import { AdblockSyntax } from '../../utils/adblockers.js';
import { CosmeticRuleSeparatorUtils } from '../../utils/cosmetic-rule-separator.js';
import { BaseParser } from '../base-parser.js';
import { defaultParserOptions } from '../options.js';
import { isNull } from '../../utils/type-guards.js';

/**
 * `AgentParser` is responsible for parsing an Adblock agent rules.
 * Adblock agent comment marks that the filter list is supposed to
 * be used by the specified ad blockers.
 *
 * @example
 *  - ```adblock
 *    [AdGuard]
 *    ```
 *  - ```adblock
 *    [Adblock Plus 2.0]
 *    ```
 *  - ```adblock
 *    [uBlock Origin]
 *    ```
 *  - ```adblock
 *    [uBlock Origin 1.45.3]
 *    ```
 *  - ```adblock
 *    [Adblock Plus 2.0; AdGuard]
 *    ```
 */
export class AgentCommentParser extends BaseParser {
    /**
     * Checks if the raw rule is an adblock agent comment.
     *
     * @param raw Raw rule
     * @returns `true` if the rule is an adblock agent, `false` otherwise
     */
    public static isAgentRule(raw: string): boolean {
        const rawTrimmed = raw.trim();

        if (rawTrimmed.startsWith(OPEN_SQUARE_BRACKET) && rawTrimmed.endsWith(CLOSE_SQUARE_BRACKET)) {
            // Avoid this case: [$adg-modifier]##[class^="adg-"]
            return isNull(CosmeticRuleSeparatorUtils.find(rawTrimmed));
        }

        return false;
    }

    /**
     * Parses a raw rule as an adblock agent comment.
     *
     * @param raw Raw input to parse.
     * @param options Global parser options.
     * @param baseOffset Starting offset of the input. Node locations are calculated relative to this offset.
     * @returns Agent rule AST or null (if the raw rule cannot be parsed as an adblock agent comment)
     */
    public static parse(raw: string, options = defaultParserOptions, baseOffset = 0): AgentCommentRule | null {
        // Ignore non-agent rules
        if (!AgentCommentParser.isAgentRule(raw)) {
            return null;
        }

        let offset = 0;

        // Skip whitespace characters before the rule
        offset = StringUtils.skipWS(raw, offset);

        // Skip opening bracket
        offset += 1;

        // last character should be a closing bracket
        const closingBracketIndex = StringUtils.skipWSBack(raw, raw.length - 1);

        if (closingBracketIndex === -1 || raw[closingBracketIndex] !== CLOSE_SQUARE_BRACKET) {
            throw new AdblockSyntaxError(
                'Missing closing bracket',
                offset,
                offset + raw.length,
            );
        }

        // Initialize the agent list
        const result: AgentCommentRule = {
            type: CommentRuleType.AgentCommentRule,
            syntax: AdblockSyntax.Common,
            category: RuleCategory.Comment,
            children: [],
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

        while (offset < closingBracketIndex) {
            // Skip whitespace characters before the agent
            offset = StringUtils.skipWS(raw, offset);

            // Find the separator or the closing bracket
            let separatorIndex = raw.indexOf(SEMICOLON, offset);

            if (separatorIndex === -1) {
                separatorIndex = closingBracketIndex;
            }

            // Find the last non-whitespace character of the agent
            // [AdGuard  ; Adblock Plus 2.0]
            //        ^
            // (if we have spaces between the agent name and the separator)
            const agentEndIndex = StringUtils.findLastNonWhitespaceCharacter(
                raw.slice(offset, separatorIndex),
            ) + offset + 1;

            // Collect the agent
            result.children.push(
                AgentParser.parse(raw.slice(offset, agentEndIndex), options, baseOffset + offset),
            );

            // Set the offset to the next agent or the end of the rule
            offset = separatorIndex + 1;
        }

        if (result.children.length === 0) {
            throw new AdblockSyntaxError(
                'Empty agent list',
                baseOffset,
                baseOffset + raw.length,
            );
        }

        return result;
    }
}
