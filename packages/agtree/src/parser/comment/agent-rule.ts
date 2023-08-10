import { locRange, shiftLoc } from '../../utils/location';
import {
    CLOSE_SQUARE_BRACKET,
    OPEN_SQUARE_BRACKET,
    SEMICOLON,
    SPACE,
} from '../../utils/constants';
import { StringUtils } from '../../utils/string';
import {
    type AgentCommentRule,
    type Location,
    defaultLocation,
    CommentRuleType,
    RuleCategory,
    type Agent,
} from '../common';
import { AgentParser } from './agent';
import { AdblockSyntaxError } from '../../errors/adblock-syntax-error';
import { AdblockSyntax } from '../../utils/adblockers';
import { CosmeticRuleSeparatorUtils } from '../../utils/cosmetic-rule-separator';

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
export class AgentCommentRuleParser {
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
            return CosmeticRuleSeparatorUtils.find(rawTrimmed) === null;
        }

        return false;
    }

    /**
     * Parses a raw rule as an adblock agent comment.
     *
     * @param raw Raw rule
     * @param loc Base location
     * @returns Agent rule AST or null (if the raw rule cannot be parsed as an adblock agent comment)
     */
    public static parse(raw: string, loc: Location = defaultLocation): AgentCommentRule | null {
        // Ignore non-agent rules
        if (!AgentCommentRuleParser.isAgentRule(raw)) {
            return null;
        }

        let offset = 0;

        // Skip whitespace characters before the rule
        offset = StringUtils.skipWS(raw, offset);

        // Skip opening bracket
        offset += 1;

        const closingBracketIndex = raw.lastIndexOf(CLOSE_SQUARE_BRACKET);

        // Initialize the agent list
        const agents: Agent[] = [];

        while (offset < closingBracketIndex) {
            // Skip whitespace characters before the agent
            offset = StringUtils.skipWS(raw, offset);

            // Find the separator or the closing bracket
            let separatorIndex = raw.indexOf(SEMICOLON, offset);

            if (separatorIndex === -1) {
                separatorIndex = closingBracketIndex;
            }

            // Find the last non-whitespace character of the agent
            const agentEndIndex = StringUtils.findLastNonWhitespaceCharacter(
                raw.substring(offset, separatorIndex),
            ) + offset + 1;

            const agent = AgentParser.parse(raw.substring(offset, agentEndIndex), shiftLoc(loc, offset));

            // Collect the agent
            agents.push(agent);

            // Set the offset to the next agent or the end of the rule
            offset = separatorIndex + 1;
        }

        if (agents.length === 0) {
            throw new AdblockSyntaxError(
                'Empty agent list',
                locRange(loc, 0, raw.length),
            );
        }

        return {
            type: CommentRuleType.AgentCommentRule,
            loc: locRange(loc, 0, raw.length),
            raws: {
                text: raw,
            },
            syntax: AdblockSyntax.Common,
            category: RuleCategory.Comment,
            children: agents,
        };
    }

    /**
     * Converts an adblock agent AST to a string.
     *
     * @param ast Agent rule AST
     * @returns Raw string
     */
    public static generate(ast: AgentCommentRule): string {
        let result = OPEN_SQUARE_BRACKET;

        result += ast.children
            .map(AgentParser.generate)
            .join(SEMICOLON + SPACE);

        result += CLOSE_SQUARE_BRACKET;

        return result;
    }
}
