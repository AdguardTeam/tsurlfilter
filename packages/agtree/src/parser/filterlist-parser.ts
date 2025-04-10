import { type AnyRule, type FilterList, type NewLine } from '../nodes';
import { RuleParser } from './rule-parser';
import { CR, LF } from '../utils/constants';
import { StringUtils } from '../utils/string';
import { defaultParserOptions } from './options';
import { BaseParser } from './base-parser';

/**
 * `FilterListParser` is responsible for parsing a whole adblock filter list (list of rules).
 * It is a wrapper around `RuleParser` which parses each line separately.
 */
export class FilterListParser extends BaseParser {
    /**
     * Parses a whole adblock filter list (list of rules).
     *
     * @param raw Raw input to parse.
     * @param options Global parser options.
     * @param baseOffset Starting offset of the input. Node locations are calculated relative to this offset.
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
    public static parse(raw: string, options = defaultParserOptions, baseOffset = 0): FilterList {
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
                const text = raw.slice(lineStartOffset, offset);

                // Parse the rule
                const rule = RuleParser.parse(text, options, lineStartOffset);

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
            RuleParser.parse(raw.slice(lineStartOffset, offset), options, baseOffset + lineStartOffset),
        );

        // Return the list of rules (FilterList node)
        const result: FilterList = {
            type: 'FilterList',
            children: rules,
        };

        if (options.isLocIncluded) {
            result.start = baseOffset;
            result.end = baseOffset + raw.length;
        }

        return result;
    }
}
