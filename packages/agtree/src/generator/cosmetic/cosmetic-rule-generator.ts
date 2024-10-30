/* eslint-disable no-param-reassign */
import { sprintf } from 'sprintf-js';

import { AdblockSyntax } from '../../utils/adblockers';
import {
    CLOSE_PARENTHESIS,
    COLON,
    EMPTY,
    OPEN_PARENTHESIS,
    SPACE,
} from '../../utils/constants';
import { type AnyCosmeticRule } from '../../nodes';
import { BaseGenerator } from '../base-generator';
import { CosmeticRulePatternGenerator } from './cosmetic-rule-pattern-generator';
import { CosmeticRuleBodyGenerator } from './cosmetic-rule-body-generator';

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
 * `CosmeticRuleParser` is responsible for parsing cosmetic rules.
 *
 * Where possible, it automatically detects the difference between supported syntaxes:
 *  - AdGuard
 *  - uBlock Origin
 *  - Adblock Plus
 *
 * If the syntax is common / cannot be determined, the parser gives `Common` syntax.
 *
 * Please note that syntactically correct rules are parsed even if they are not actually
 * compatible with the given adblocker. This is a completely natural behavior, meaningful
 * checking of compatibility is not done at the parser level.
 */
// TODO: Make raw body parsing optional
// TODO: Split into smaller sections
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
                result += COLON;
                result += modifier.name.value;
                if (modifier.value) {
                    result += OPEN_PARENTHESIS;
                    result += modifier.value.value;
                    result += CLOSE_PARENTHESIS;
                }
            });

            // If there are at least one modifier, add a space
            if (node.modifiers.children.length) {
                result += SPACE;
            }
        }

        // Body
        result += CosmeticRuleBodyGenerator.generate(node);

        return result;
    }
}
