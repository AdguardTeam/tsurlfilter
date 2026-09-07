/**
 * @file Backwards-compatible `RuleParser` entry point.
 *
 * `@adguard/scriptlets` (v2.x) still imports `RuleParser` and
 * `defaultParserOptions` from `@adguard/agtree/parser`. AGTree v5 replaced the
 * parser with `RuleParserPipeline`, so this module keeps the legacy static API
 * working by delegating to the new pipeline.
 */

import { RuleParserPipeline } from '../ast-builder/rule-parser';
import type { AnyRule } from '../nodes';

/**
 * Legacy parser options, kept for API compatibility with pre-v5 consumers.
 */
export interface LegacyParserOptions {
    /**
     * If `true`, the parser returns an `InvalidRule` node instead of throwing.
     * Ignored by the v5 pipeline (which throws on invalid input).
     */
    tolerant?: boolean;

    /**
     * Whether to include source location info (start/end) on AST nodes.
     */
    isLocIncluded?: boolean;

    /**
     * Whether to parse Adblock Plus-specific rules.
     */
    parseAbpSpecificRules?: boolean;

    /**
     * Whether to parse uBlock Origin-specific rules.
     */
    parseUboSpecificRules?: boolean;

    /**
     * Whether to include raw source parts. Ignored by the v5 pipeline.
     */
    includeRaws?: boolean;

    /**
     * Whether to ignore comment rules. Ignored by the v5 pipeline.
     */
    ignoreComments?: boolean;

    /**
     * Whether to parse `/etc/hosts`-style host rules.
     */
    parseHostRules?: boolean;
}

/**
 * Default legacy parser options.
 */
export const defaultParserOptions: Readonly<LegacyParserOptions> = Object.freeze({
    tolerant: false,
    isLocIncluded: true,
    parseAbpSpecificRules: true,
    parseUboSpecificRules: true,
    includeRaws: true,
    ignoreComments: false,
    parseHostRules: false,
});

/**
 * Legacy rule parser, delegating to {@link RuleParserPipeline}.
 */
export class RuleParser {
    /**
     * Shared pipeline backing the legacy API.
     */
    private static readonly PIPELINE = new RuleParserPipeline();

    /**
     * Parses an adblock rule and returns its AST node.
     *
     * @param raw Raw rule source.
     * @param options Legacy parser options.
     *
     * @returns Parsed rule AST node.
     *
     * @throws If the rule is syntactically invalid.
     */
    public static parse(raw: string, options: LegacyParserOptions = defaultParserOptions): AnyRule {
        return RuleParser.PIPELINE.parse(raw, {
            isLocIncluded: options.isLocIncluded,
            parseAbpSpecificRules: options.parseAbpSpecificRules,
            parseUboSpecificRules: options.parseUboSpecificRules,
            parseHostRules: options.parseHostRules,
        });
    }
}
