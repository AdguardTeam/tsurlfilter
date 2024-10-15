import type { AnyCosmeticRule } from '../../nodes';
import {
    CLOSE_SQUARE_BRACKET,
    DOLLAR_SIGN,
    EMPTY,
    OPEN_SQUARE_BRACKET,
} from '../../utils/constants';
import { AdblockSyntax } from '../../utils/adblockers';
import { BaseGenerator } from '../base-generator';
import { ModifierListGenerator } from '../misc/modifier-list-generator';
import { DomainListGenerator } from '../misc/domain-list-generator';

export class CosmeticRulePatternGenerator extends BaseGenerator {
    /**
     * Generates the rule pattern from the AST.
     *
     * @param node Cosmetic rule node
     * @returns Raw rule pattern
     * @example
     * - '##.foo' → ''
     * - 'example.com,example.org##.foo' → 'example.com,example.org'
     * - '[$path=/foo/bar]example.com##.foo' → '[$path=/foo/bar]example.com'
     */
    public static generate(node: AnyCosmeticRule): string {
        let result = EMPTY;

        // AdGuard modifiers (if any)
        if (node.syntax === AdblockSyntax.Adg && node.modifiers && node.modifiers.children.length > 0) {
            result += OPEN_SQUARE_BRACKET;
            result += DOLLAR_SIGN;
            result += ModifierListGenerator.generate(node.modifiers);
            result += CLOSE_SQUARE_BRACKET;
        }

        // Domain list (if any)
        result += DomainListGenerator.generate(node.domains);

        return result;
    }
}
