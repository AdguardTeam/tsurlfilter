import {
    AnyRule,
    FilterList,
    NewLine,
    defaultLocation,
} from './common';
import { RuleParser } from './rule';
import {
    CR,
    CRLF,
    EMPTY,
    LF,
} from '../utils/constants';
import { StringUtils } from '../utils/string';

/**
 * `FilterListParser` is responsible for parsing a whole adblock filter list (list of rules).
 * It is a wrapper around `RuleParser` which parses each line separately.
 */
export class FilterListParser {
    /**
     * Parses a whole adblock filter list (list of rules).
     *
     * @param raw Filter list source code (including new lines)
     * @param tolerant If `true`, then the parser will not throw if the rule is syntactically invalid,
     * instead it will return an `InvalidRule` object with the error attached to it. Default is `true`.
     * It is useful for parsing filter lists with invalid rules, because most of the rules are valid,
     * and some invalid rules can't break the whole filter list parsing.
     * @returns AST of the source code (list of rules)
     * @example
     * ```js
     * import { readFileSync } from 'fs';
     * import { FilterListParser } from '@adguard/agtree';
     *
     * // Read filter list content from file
     * const content = readFileSync('your-adblock-filter-list.txt', 'utf-8');
     *
     * // Parse the filter list content, then do something with the AST
     * const ast = FilterListParser.parse(content);
     * ```
     * @throws If one of the rules is syntactically invalid (if `tolerant` is `false`)
     */
    public static parse(raw: string, tolerant = true): FilterList {
        // Actual position in the source code
        let offset = 0;

        // Collect adblock rules here
        const rules: AnyRule[] = [];

        // Start offset of the current line (initially it's 0)
        let lineStartOffset = offset;

        while (offset < raw.length) {
            // Check if we found a new line
            if (StringUtils.isEOL(raw[offset])) {
                // Rule text
                const text = raw.substring(lineStartOffset, offset);

                // Parse the rule
                const rule = RuleParser.parse(text, tolerant, {
                    offset: lineStartOffset,
                    line: rules.length + 1,
                    column: 1,
                });

                // Get newline type (possible values: 'crlf', 'lf', 'cr' or undefined if no newline found)
                let nl: NewLine | undefined;

                if (raw[offset] === CR) {
                    if (raw[offset + 1] === LF) {
                        nl = 'crlf';
                    } else {
                        nl = 'cr';
                    }
                } else if (raw[offset] === LF) {
                    nl = 'lf';
                }

                // Add newline type to the rule (rule parser already added raws.text)
                if (!rule.raws) {
                    rule.raws = {
                        text,
                        nl,
                    };
                } else {
                    rule.raws.nl = nl;
                }

                // Add the rule to the list
                rules.push(rule);

                // Update offset: add 2 if we found CRLF, otherwise add 1
                offset += nl === 'crlf' ? 2 : 1;

                // Update line start offset
                lineStartOffset = offset;
            } else {
                // No new line found, just increase offset
                offset += 1;
            }
        }

        // Parse the last rule (it doesn't end with a new line)
        rules.push(
            RuleParser.parse(raw.substring(lineStartOffset, offset), tolerant, {
                offset: lineStartOffset,
                line: rules.length + 1,
                column: 1,
            }),
        );

        // Return the list of rules (FilterList node)
        return {
            type: 'FilterList',
            loc: {
                // Start location is always the default, since we don't provide
                // "loc" parameter for FilterListParser.parse as it doesn't have
                // any parent
                start: defaultLocation,

                // Calculate end location
                end: {
                    offset: raw.length,
                    line: rules.length,
                    column: raw.length + 1,
                },
            },
            children: rules,
        };
    }

    /**
     * Serializes a whole adblock filter list (list of rules).
     *
     * @param ast AST to generate
     * @param preferRaw If `true`, then the parser will use `raws.text` property of each rule
     * if it is available. Default is `false`.
     * @returns Serialized filter list
     */
    public static generate(ast: FilterList, preferRaw = false): string {
        let result = EMPTY;

        for (const rule of ast.children) {
            if (preferRaw && rule.raws?.text) {
                result += rule.raws.text;
            } else {
                result += RuleParser.generate(rule);
            }

            switch (rule.raws?.nl) {
                case 'crlf':
                    result += CRLF;
                    break;
                case 'cr':
                    result += CR;
                    break;
                case 'lf':
                    result += LF;
                    break;
                default:
                    break;
            }
        }

        return result;
    }
}
