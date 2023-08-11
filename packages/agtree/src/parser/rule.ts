import { AdblockSyntax } from '../utils/adblockers';
import { EMPTY } from '../utils/constants';
import { locRange } from '../utils/location';
import { CommentRuleParser } from './comment';
import { CosmeticRuleParser } from './cosmetic';
import { NetworkRuleParser } from './network';
import {
    type AnyRule,
    type InvalidRule,
    RuleCategory,
    defaultLocation,
} from './common';
import { AdblockSyntaxError } from '../errors/adblock-syntax-error';

/**
 * `RuleParser` is responsible for parsing the rules.
 *
 * It automatically determines the category and syntax of the rule, so you can pass any kind of rule to it.
 */
export class RuleParser {
    /**
     * Parse an adblock rule. You can pass any kind of rule to this method, since it will automatically determine
     * the category and syntax. If the rule is syntactically invalid, then an error will be thrown. If the
     * syntax / compatibility cannot be determined clearly, then the value of the `syntax` property will be
     * `Common`.
     *
     * For example, let's have this network rule:
     * ```adblock
     * ||example.org^$important
     * ```
     * The `syntax` property will be `Common`, since the rule is syntactically correct in every adblockers, but we
     * cannot determine at parsing level whether `important` is an existing option or not, nor if it exists, then
     * which adblocker supports it. This is why the `syntax` property is simply `Common` at this point.
     * The concrete COMPATIBILITY of the rule will be determined later, in a different, higher-level layer, called
     * "Compatibility table".
     *
     * But we can determinate the concrete syntax of this rule:
     * ```adblock
     * example.org#%#//scriptlet("scriptlet0", "arg0")
     * ```
     * since it is clearly an AdGuard-specific rule and no other adblockers uses this syntax natively. However, we also
     * cannot determine the COMPATIBILITY of this rule, as it is not clear at this point whether the `scriptlet0`
     * scriptlet is supported by AdGuard or not. This is also the task of the "Compatibility table". Here, we simply
     * mark the rule with the `AdGuard` syntax in this case.
     *
     * @param raw Raw adblock rule
     * @param tolerant If `true`, then the parser will not throw if the rule is syntactically invalid, instead it will
     * return an `InvalidRule` object with the error attached to it. Default is `false`.
     * @param loc Base location of the rule
     * @returns Adblock rule AST
     * @throws If the input matches a pattern but syntactically invalid
     * @example
     * Take a look at the following example:
     * ```js
     * // Parse a network rule
     * const ast1 = RuleParser.parse("||example.org^$important");
     *
     * // Parse another network rule
     * const ast2 = RuleParser.parse("/ads.js^$important,third-party,domain=example.org|~example.com");
     *
     * // Parse a cosmetic rule
     * const ast2 = RuleParser.parse("example.org##.banner");
     *
     * // Parse another cosmetic rule
     * const ast3 = RuleParser.parse("example.org#?#.banner:-abp-has(.ad)");
     *
     * // Parse a comment rule
     * const ast4 = RuleParser.parse("! Comment");
     *
     * // Parse an empty rule
     * const ast5 = RuleParser.parse("");
     *
     * // Parse a comment rule (with metadata)
     * const ast6 = RuleParser.parse("! Title: Example");
     *
     * // Parse a pre-processor rule
     * const ast7 = RuleParser.parse("!#if (adguard)");
     * ```
     */
    public static parse(raw: string, tolerant = false, loc = defaultLocation): AnyRule {
        try {
            // Empty lines / rules (handle it just for convenience)
            if (raw.trim().length === 0) {
                return {
                    type: 'EmptyRule',
                    loc: locRange(loc, 0, raw.length),
                    raws: {
                        text: raw,
                    },
                    category: RuleCategory.Empty,
                    syntax: AdblockSyntax.Common,
                };
            }

            // Try to parse the rule with all sub-parsers. If a rule doesn't match
            // the pattern of a parser, then it will return `null`. For example, a
            // network rule will not match the pattern of a comment rule, since it
            // doesn't start with comment marker. But if the rule matches the
            // pattern of a parser, then it will return the AST of the rule, or
            // throw an error if the rule is syntactically invalid.
            return CommentRuleParser.parse(raw, loc)
                || CosmeticRuleParser.parse(raw, loc)
                || NetworkRuleParser.parse(raw, loc);
        } catch (error: unknown) {
            // If tolerant mode is disabled or the error is not known, then simply
            // re-throw the error
            if (!tolerant || !(error instanceof Error)) {
                throw error;
            }

            // Otherwise, return an invalid rule (tolerant mode)
            const result: InvalidRule = {
                type: 'InvalidRule',
                loc: locRange(loc, 0, raw.length),
                raws: {
                    text: raw,
                },
                category: RuleCategory.Invalid,
                syntax: AdblockSyntax.Common,
                raw,
                error: {
                    name: error.name,
                    message: error.message,
                },
            };

            // If the error is an AdblockSyntaxError, then we can add the
            // location of the error to the result
            if (error instanceof AdblockSyntaxError) {
                result.error.loc = error.loc;
            }

            return result;
        }
    }

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
                return CommentRuleParser.generate(ast);

            // Cosmetic / non-basic rules
            case RuleCategory.Cosmetic:
                return CosmeticRuleParser.generate(ast);

            // Network / basic rules
            case RuleCategory.Network:
                return NetworkRuleParser.generate(ast);

            default:
                throw new Error('Unknown rule category');
        }
    }
}
