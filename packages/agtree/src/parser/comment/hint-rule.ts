import {
    BACKSLASH,
    CLOSE_PARENTHESIS,
    HINT_MARKER,
    HINT_MARKER_LEN,
    OPEN_PARENTHESIS,
    SPACE,
} from '../../utils/constants';
import { StringUtils } from '../../utils/string';
import {
    CommentRuleType,
    type Hint,
    type HintCommentRule,
    RuleCategory,
} from '../common';
import { HintParser } from './hint';
import { locRange, shiftLoc } from '../../utils/location';
import { AdblockSyntax } from '../../utils/adblockers';
import { AdblockSyntaxError } from '../../errors/adblock-syntax-error';
import { getParserOptions, type ParserOptions } from '../options';

/**
 * `HintRuleParser` is responsible for parsing AdGuard hint rules.
 *
 * @example
 * The following hint rule
 * ```adblock
 * !+ NOT_OPTIMIZED PLATFORM(windows)
 * ```
 * contains two hints: `NOT_OPTIMIZED` and `PLATFORM`.
 * @see {@link https://kb.adguard.com/en/general/how-to-create-your-own-ad-filters#hints}
 */
export class HintCommentRuleParser {
    /**
     * Checks if the raw rule is a hint rule.
     *
     * @param raw Raw rule
     * @returns `true` if the rule is a hint rule, `false` otherwise
     */
    public static isHintRule(raw: string): boolean {
        return raw.trim().startsWith(HINT_MARKER);
    }

    /**
     * Parses a raw rule as a hint comment.
     *
     * @param raw Raw rule
     * @param options Parser options. See {@link ParserOptions}.
     * @returns Hint AST or null (if the raw rule cannot be parsed as a hint comment)
     * @throws If the input matches the HINT pattern but syntactically invalid
     * @see {@link https://kb.adguard.com/en/general/how-to-create-your-own-ad-filters#hints-1}
     */
    public static parse(raw: string, options: Partial<ParserOptions> = {}): HintCommentRule | null {
        const { baseLoc, isLocIncluded } = getParserOptions(options);

        // Ignore non-hint rules
        if (!HintCommentRuleParser.isHintRule(raw)) {
            return null;
        }

        let offset = 0;

        // Skip whitespace characters before the rule
        offset = StringUtils.skipWS(raw);

        // Skip hint marker
        offset += HINT_MARKER_LEN;

        const hints: Hint[] = [];

        // Collect hints. Each hint is a string, optionally followed by a parameter list,
        // enclosed in parentheses. One rule can contain multiple hints.
        while (offset < raw.length) {
            // Split rule into raw hints (e.g. 'HINT_NAME' or 'HINT_NAME(PARAMS)')
            // Hints are separated by whitespace characters, but we should ignore
            // whitespace characters inside the parameter list

            // Ignore whitespace characters before the hint
            offset = StringUtils.skipWS(raw, offset);

            // Save the start index of the hint
            const hintStartIndex = offset;

            // Find the end of the hint
            let hintEndIndex = offset;
            let balance = 0;

            while (hintEndIndex < raw.length) {
                if (raw[hintEndIndex] === OPEN_PARENTHESIS && raw[hintEndIndex - 1] !== BACKSLASH) {
                    balance += 1;

                    // Throw error for nesting
                    if (balance > 1) {
                        throw new AdblockSyntaxError(
                            'Invalid hint: nested parentheses are not allowed',
                            locRange(baseLoc, hintStartIndex, hintEndIndex),
                        );
                    }
                } else if (raw[hintEndIndex] === CLOSE_PARENTHESIS && raw[hintEndIndex - 1] !== BACKSLASH) {
                    balance -= 1;
                } else if (StringUtils.isWhitespace(raw[hintEndIndex]) && balance === 0) {
                    break;
                }

                hintEndIndex += 1;
            }

            offset = hintEndIndex;

            // Skip whitespace characters after the hint
            offset = StringUtils.skipWS(raw, offset);

            // Parse the hint
            const hint = HintParser.parse(
                raw.substring(hintStartIndex, hintEndIndex),
                {
                    isLocIncluded,
                    baseLoc: shiftLoc(baseLoc, hintStartIndex),
                },
            );

            hints.push(hint);
        }

        // Throw error if no hints were found
        if (hints.length === 0) {
            throw new AdblockSyntaxError(
                'Empty hint rule',
                locRange(baseLoc, 0, offset),
            );
        }

        const result: HintCommentRule = {
            type: CommentRuleType.HintCommentRule,
            raws: {
                text: raw,
            },
            category: RuleCategory.Comment,
            syntax: AdblockSyntax.Adg,
            children: hints,
        };

        if (isLocIncluded) {
            result.loc = locRange(baseLoc, 0, offset);
        }

        return result;
    }

    /**
     * Converts a hint rule AST to a raw string.
     *
     * @param ast Hint rule AST
     * @returns Raw string
     */
    public static generate(ast: HintCommentRule): string {
        let result = HINT_MARKER + SPACE;

        result += ast.children.map(HintParser.generate).join(SPACE);

        return result;
    }
}
