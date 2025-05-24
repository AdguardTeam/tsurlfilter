/* eslint-disable no-param-reassign */
import { type FilterList } from '../nodes/index.js';
import {
    CR,
    CRLF,
    EMPTY,
    LF,
} from '../utils/constants';
import { RuleGenerator } from './rule-generator.js';
import { BaseGenerator } from './base-generator.js';

/**
 * Generates a serialized filter list.
 */
export class FilterListGenerator extends BaseGenerator {
    /**
     * Serializes a whole adblock filter list (list of rules).
     *
     * @param ast AST to generate
     * @param preferRaw If `true`, then the parser will use `raws.text` property of each rule
     * if it is available. Default is `false`.
     * @param tolerant If `true`, errors during rule generation will be logged to the console and invalid rules
     * will be skipped. If `false`, an error will be thrown on the first invalid rule. Default is `true`.
     * @returns Serialized filter list
     */
    public static generate(ast: FilterList, preferRaw = false, tolerant = true): string {
        let result = EMPTY;

        for (let i = 0; i < ast.children.length; i += 1) {
            const rule = ast.children[i];

            if (preferRaw && rule.raws?.text) {
                result += rule.raws.text;
            } else {
                try {
                    result += RuleGenerator.generate(rule);
                } catch (error: unknown) {
                    if (tolerant) {
                        // eslint-disable-next-line no-console
                        console.error(`Error when generating: ${error}`);
                    } else {
                        throw new Error(String(error));
                    }
                }
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
