/* eslint-disable no-param-reassign */
import { sprintf } from 'sprintf-js';

import { AdblockSyntax } from '../../utils/adblockers.js';
import {
    CLOSE_PARENTHESIS,
    COLON,
    CSS_NOT_PSEUDO,
    EMPTY,
    OPEN_PARENTHESIS,
    SPACE,
} from '../../utils/constants.js';
import { type AnyCosmeticRule } from '../../nodes/index.js';
import { BaseGenerator } from '../base-generator.js';
import { CosmeticRulePatternGenerator } from './cosmetic-rule-pattern-generator.js';
import { CosmeticRuleBodyGenerator } from './cosmetic-rule-body-generator.js';

/**
 * Possible error messages for uBO selectors. Formatted with {@link sprintf}.
 */
export const ERROR_MESSAGES = {
    EMPTY_RULE_BODY: 'Empty rule body',
    INVALID_BODY_FOR_SEPARATOR: "Body '%s' is not valid for the '%s' cosmetic rule separator",
    MISSING_ADGUARD_MODIFIER_LIST_END: "Missing '%s' at the end of the AdGuard modifier list in pattern '%s'",
    MISSING_ADGUARD_MODIFIER_LIST_MARKER: "Missing '%s' at the beginning of the AdGuard modifier list in pattern '%s'",
    SYNTAXES_CANNOT_BE_MIXED: "'%s' syntax cannot be mixed with '%s' syntax",
    SYNTAX_DISABLED: "Parsing '%s' syntax is disabled, but the rule uses it",
};

/**
 * `CosmeticRuleGenerator` is responsible for generating cosmetic rules from their AST representation.
 *
 * This class takes a parsed cosmetic rule Abstract Syntax Tree (AST) and converts it back into a raw string format.
 * It handles the generation of the pattern, separator, uBO rule modifiers, and the rule body.
 */
export class CosmeticRuleGenerator extends BaseGenerator {
    /**
     * Converts a cosmetic rule AST into a string.
     *
     * @param node Cosmetic rule AST
     * @returns Raw string
     */
    public static generate(node: AnyCosmeticRule): string {
        let result = EMPTY;

        // Pattern
        result += CosmeticRulePatternGenerator.generate(node);

        // Separator
        result += node.separator.value;

        // uBO rule modifiers
        if (node.syntax === AdblockSyntax.Ubo && node.modifiers) {
            node.modifiers.children.forEach((modifier) => {
                if (modifier.exception) {
                    result += COLON;
                    result += CSS_NOT_PSEUDO;
                    result += OPEN_PARENTHESIS;
                }
                result += COLON;
                result += modifier.name.value;
                if (modifier.value) {
                    result += OPEN_PARENTHESIS;
                    result += modifier.value.value;
                    result += CLOSE_PARENTHESIS;
                }
                if (modifier.exception) {
                    result += CLOSE_PARENTHESIS;
                }
            });

            // If there are at least one modifier, add a space
            if (node.modifiers.children.some((modifier) => modifier?.name.value)) {
                result += SPACE;
            }
        }

        // Body
        result += CosmeticRuleBodyGenerator.generate(node);

        return result;
    }
}
