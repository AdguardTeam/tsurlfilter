/* eslint-disable no-param-reassign */
import { type FilterList } from '../nodes';
import {
    CR,
    CRLF,
    EMPTY,
    LF,
} from '../utils/constants';
import { RuleGenerator } from './rule-generator';
import { BaseGenerator } from './base-generator';

/**
 * `FilterListParser` is responsible for parsing a whole adblock filter list (list of rules).
 * It is a wrapper around `RuleParser` which parses each line separately.
 */
export class FilterListGenerator extends BaseGenerator {
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

        for (let i = 0; i < ast.children.length; i += 1) {
            const rule = ast.children[i];

            if (preferRaw && rule.raws?.text) {
                result += rule.raws.text;
            } else {
                result += RuleGenerator.generate(rule);
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
                    if (i !== ast.children.length - 1) {
                        result += LF;
                    }
                    break;
            }
        }

        return result;
    }
}
