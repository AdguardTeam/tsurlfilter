import { type AnyCosmeticRule, CosmeticRuleType } from '../../nodes';
import {
    CLOSE_SQUARE_BRACKET,
    DOLLAR_SIGN,
    EMPTY,
    OPEN_SQUARE_BRACKET,
} from '../../utils/constants';
import { SYNTAX_ADG } from '../../utils/syntax-flags';
import { BaseGenerator } from '../base-generator';
import { DomainListGenerator } from '../misc/domain-list-generator';
import { ModifierListGenerator } from '../misc/modifier-list-generator';

/**
 * Cosmetic rule pattern generator.
 */
export class CosmeticRulePatternGenerator extends BaseGenerator {
    /**
     * Whether the rule's modifier list comes from an AdGuard `[$…]` prefix
     * rather than from uBO pseudo-class modifiers.
     *
     * Such modifiers can only appear on element hiding and uBO CSS injection
     * rules. On any other cosmetic rule (scriptlet injection — both AdGuard
     * and ABP — and HTML filtering) a non-empty modifier list can only come
     * from the AdGuard `[$…]` prefix, even though the body syntax is not
     * AdGuard. The generator used to drop the list for those rules (silently
     * broadening the rule) or emit `:path()`/`:domain()` pseudo-classes
     * (F-032).
     *
     * @param node Cosmetic rule node.
     *
     * @returns `true` if the modifiers must be generated as a `[$…]` list.
     */
    public static hasAdgModifierList(node: AnyCosmeticRule): boolean {
        if (!node.modifiers || node.modifiers.children.length === 0) {
            return false;
        }

        return node.syntax === SYNTAX_ADG
            || node.type === CosmeticRuleType.ScriptletInjectionRule
            || node.type === CosmeticRuleType.HtmlFilteringRule;
    }

    /**
     * Generates the rule pattern from the AST.
     *
     * @param node Cosmetic rule node.
     *
     * @returns Raw rule pattern.
     *
     * @example
     * - '##.foo' → ''
     * - 'example.com,example.org##.foo' → 'example.com,example.org'
     * - '[$path=/foo/bar]example.com##.foo' → '[$path=/foo/bar]example.com'
     */
    public static generate(node: AnyCosmeticRule): string {
        let result = EMPTY;

        // AdGuard modifiers (if any)
        const { modifiers } = node;
        if (modifiers && CosmeticRulePatternGenerator.hasAdgModifierList(node)) {
            result += OPEN_SQUARE_BRACKET;
            result += DOLLAR_SIGN;
            result += ModifierListGenerator.generate(modifiers);
            result += CLOSE_SQUARE_BRACKET;
        }

        // Domain list (if any)
        result += DomainListGenerator.generate(node.domains);

        return result;
    }
}
