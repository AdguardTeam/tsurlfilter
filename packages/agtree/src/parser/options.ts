/**
 * @file Parser options.
 *
 * Centralised location for the public option types accepted by the
 * top-level {@link RuleParser}, together with their defaults and the
 * resolver helper that normalises caller input.
 */

/**
 * Options for `RuleParser.parse()`.
 */
export interface RuleParserOptions {
    /**
     * Whether to detect uBO modifiers (default true).
     */
    parseUboSpecificRules?: boolean;

    /**
     * Whether to detect ABP-specific rules (default true).
     */
    parseAbpSpecificRules?: boolean;

    /**
     * Whether to invoke HTML filtering sub-parsers on HTML filtering bodies
     * (default false).
     */
    parseHtmlFilteringRuleBodies?: boolean;

    /**
     * When `true`, cosmetic rules are classified but not parsed.
     * `RuleParser.parse()` returns `RuleKind.Cosmetic` without writing
     * any cosmetic-specific data to `ctx.data` beyond `ctx.data[0]` (which
     * is zeroed). Defaults to `false`.
     */
    ignoreCosmetic?: boolean;

    /**
     * When `true`, network rules are classified but not parsed.
     * `RuleParser.parse()` returns `RuleKind.Network` without writing
     * any network-specific data to `ctx.data` beyond `ctx.data[0]` (which
     * is zeroed). Defaults to `false`.
     */
    ignoreNetwork?: boolean;
}

/**
 * Default values for {@link RuleParserOptions}.
 *
 * Exported so tests and downstream consumers can reference the canonical
 * defaults without re-typing them.
 */
export const DEFAULT_RULE_PARSER_OPTIONS: Required<RuleParserOptions> = {
    parseUboSpecificRules: true,
    parseAbpSpecificRules: true,
    parseHtmlFilteringRuleBodies: false,
    ignoreCosmetic: false,
    ignoreNetwork: false,
};

/**
 * Resolves a partial {@link RuleParserOptions} object against the canonical
 * defaults.
 *
 * @param options Partial options object (or `undefined`).
 *
 * @returns A fully populated, immutable view of the resolved options.
 */
export function resolveRuleParserOptions(
    options?: RuleParserOptions,
): Required<RuleParserOptions> {
    if (options === undefined) {
        return DEFAULT_RULE_PARSER_OPTIONS;
    }
    return {
        parseUboSpecificRules:
            options.parseUboSpecificRules ?? DEFAULT_RULE_PARSER_OPTIONS.parseUboSpecificRules,
        parseAbpSpecificRules:
            options.parseAbpSpecificRules ?? DEFAULT_RULE_PARSER_OPTIONS.parseAbpSpecificRules,
        parseHtmlFilteringRuleBodies:
            options.parseHtmlFilteringRuleBodies
            ?? DEFAULT_RULE_PARSER_OPTIONS.parseHtmlFilteringRuleBodies,
        ignoreCosmetic:
            options.ignoreCosmetic ?? DEFAULT_RULE_PARSER_OPTIONS.ignoreCosmetic,
        ignoreNetwork:
            options.ignoreNetwork ?? DEFAULT_RULE_PARSER_OPTIONS.ignoreNetwork,
    };
}
