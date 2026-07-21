/* eslint-disable no-param-reassign */
import { type FilterList } from '../nodes-new';
import { EMPTY, LF } from '../utils/constants';

import { BaseGenerator } from './base-generator';
import { RuleGenerator } from './rule-generator';

/**
 * Generates a serialized filter list.
 */
export class FilterListGenerator extends BaseGenerator {
    /**
     * Serializes a whole adblock filter list (list of rules).
     *
     * @param ast AST to generate.
     * @param tolerant If `true`, errors during rule generation will be logged to the console and invalid rules
     * will be skipped. If `false`, an error will be thrown on the first invalid rule. Default is `true`.
     *
     * @returns Serialized filter list.
     */
    public static generate(ast: FilterList, tolerant = true): string {
        let result = EMPTY;

        for (let i = 0; i < ast.children.length; i += 1) {
            const rule = ast.children[i];

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

            // Separate rules with a line feed, but do not append a trailing
            // newline after the last rule.
            if (i !== ast.children.length - 1) {
                result += LF;
            }
        }

        return result;
    }
}
