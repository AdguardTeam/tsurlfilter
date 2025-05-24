import { BaseGenerator } from './base-generator.js';
import { type AnyRule, NetworkRuleType, RuleCategory } from '../nodes/index.js';
import { EMPTY } from '../utils/constants.js';
import { CommentRuleGenerator } from './comment/index.js';
import { CosmeticRuleGenerator } from './cosmetic/index.js';
import { HostRuleGenerator, NetworkRuleGenerator } from './network/index.js';

/**
 * RuleGenerator is responsible for converting adblock rule ASTs to their string representation.
 */
export class RuleGenerator extends BaseGenerator {
    /**
     * Converts a rule AST to a string.
     *
     * @param ast - Adblock rule AST
     * @returns Raw string
     * @example
     * Take a look at the following example:
     * ```js
     * // Parse the rule to the AST
     * const ast = RuleParser.parse("example.org##.banner");
     * // Generate the rule from the AST
     * const raw = RuleParser.generate(ast);
     * // Print the generated rule
     * console.log(raw); // "example.org##.banner"
     * ```
     */
    public static generate(ast: AnyRule): string {
        switch (ast.category) {
            // Empty lines
            case RuleCategory.Empty:
                return EMPTY;

            // Invalid rules
            case RuleCategory.Invalid:
                return ast.raw;

            // Comment rules
            case RuleCategory.Comment:
                return CommentRuleGenerator.generate(ast);

            // Cosmetic / non-basic rules
            case RuleCategory.Cosmetic:
                return CosmeticRuleGenerator.generate(ast);

            // Network / basic rules
            case RuleCategory.Network:
                switch (ast.type) {
                    case NetworkRuleType.HostRule:
                        return HostRuleGenerator.generate(ast);
                    case NetworkRuleType.NetworkRule:
                        return NetworkRuleGenerator.generate(ast);
                    default:
                        throw new Error('Unknown network rule type');
                }

            default:
                throw new Error('Unknown rule category');
        }
    }
}
