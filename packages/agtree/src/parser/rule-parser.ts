/* eslint-disable no-param-reassign */
import { AdblockSyntax } from '../utils/adblockers';
import { CommentParser } from './comment/comment-parser';
import { CosmeticRuleParser } from './cosmetic/cosmetic-rule-parser';
import { NetworkRuleParser } from './network/network-rule-parser';
import {
    type AnyRule,
    type InvalidRule,
    RuleCategory,
    type EmptyRule,
    type InvalidRuleError,
    type NetworkRule,
    type HostRule,
} from '../nodes';
import { AdblockSyntaxError } from '../errors/adblock-syntax-error';
import { defaultParserOptions } from './options';
import { BaseParser } from './base-parser';
import { HostRuleParser } from './network/host-rule-parser';

/**
 * `RuleParser` is responsible for parsing the rules.
 *
 * It automatically determines the category and syntax of the rule, so you can pass any kind of rule to it.
 */
export class RuleParser extends BaseParser {
    /**
     * Helper method to parse host rules if the `parseHostRules` option is enabled, otherwise it will
     * parse network rules.
     *
     * @param raw Raw input to parse.
     * @param options Global parser options.
     * @param baseOffset Starting offset of the input. Node locations are calculated relative to this offset.
     * @returns Host rule or network rule node.
     */
    private static parseHostOrNetworkRule(
        raw: string,
        options: typeof defaultParserOptions,
        baseOffset: number,
    ): HostRule | NetworkRule {
        if (options.parseHostRules) {
            try {
                return HostRuleParser.parse(raw, options, baseOffset);
            } catch (error: unknown) {
                // Ignore the error, and fall back to network rule parser
            }
        }

        return NetworkRuleParser.parse(raw, options, baseOffset);
    }

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
     * @param raw Raw input to parse.
     * @param options Global parser options.
     * @param baseOffset Starting offset of the input. Node locations are calculated relative to this offset.
     * @returns Adblock rule node
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
    public static parse(raw: string, options = defaultParserOptions, baseOffset = 0): AnyRule {
        try {
            // Empty lines / rules (handle it just for convenience)
            if (raw.trim().length === 0) {
                const result: EmptyRule = {
                    type: 'EmptyRule',
                    category: RuleCategory.Empty,
                    syntax: AdblockSyntax.Common,
                };

                if (options.includeRaws) {
                    result.raws = {
                        text: raw,
                    };
                }

                if (options.isLocIncluded) {
                    result.start = baseOffset;
                    result.end = baseOffset + raw.length;
                }

                return result;
            }

            // Try to parse the rule with all sub-parsers. If a rule doesn't match
            // the pattern of a parser, then it will return `null`. For example, a
            // network rule will not match the pattern of a comment rule, since it
            // doesn't start with comment marker. But if the rule matches the
            // pattern of a parser, then it will return the AST of the rule, or
            // throw an error if the rule is syntactically invalid.
            if (options.ignoreComments) {
                if (CommentParser.isCommentRule(raw)) {
                    const result: EmptyRule = {
                        type: 'EmptyRule',
                        category: RuleCategory.Empty,
                        syntax: AdblockSyntax.Common,
                    };

                    if (options.includeRaws) {
                        result.raws = {
                            text: raw,
                        };
                    }

                    if (options.isLocIncluded) {
                        result.start = baseOffset;
                        result.end = baseOffset + raw.length;
                    }

                    return result;
                }

                return CosmeticRuleParser.parse(raw, options, baseOffset)
                    || RuleParser.parseHostOrNetworkRule(raw, options, baseOffset);
            }

            return CommentParser.parse(raw, options, baseOffset)
                || CosmeticRuleParser.parse(raw, options, baseOffset)
                || RuleParser.parseHostOrNetworkRule(raw, options, baseOffset);
        } catch (error: unknown) {
            // If tolerant mode is disabled or the error is not known, then simply
            // re-throw the error
            if (!options.tolerant || !(error instanceof Error)) {
                throw error;
            }

            const errorNode: InvalidRuleError = {
                type: 'InvalidRuleError',
                name: error.name,
                message: error.message,
            };

            // If the error is an AdblockSyntaxError, then we can add the
            // location of the error to the result
            if (error instanceof AdblockSyntaxError) {
                errorNode.start = error.start;
                errorNode.end = error.end;
            }

            // Otherwise, return an invalid rule (tolerant mode)
            const result: InvalidRule = {
                type: 'InvalidRule',
                category: RuleCategory.Invalid,
                syntax: AdblockSyntax.Common,
                raw,
                error: errorNode,
            };

            if (options.includeRaws) {
                result.raws = {
                    text: raw,
                };
            }

            if (options.isLocIncluded) {
                result.start = baseOffset;
                result.end = baseOffset + raw.length;
            }

            return result;
        }
    }
}
