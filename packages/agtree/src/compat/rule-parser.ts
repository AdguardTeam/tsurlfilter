/**
 * @file Backwards-compatible `RuleParser` entry point.
 *
 * `@adguard/scriptlets` (v2.x) still imports `RuleParser` and
 * `defaultParserOptions` from `@adguard/agtree/parser`. AGTree v5 replaced the
 * parser with `RuleParserPipeline`, so this module keeps the legacy static API
 * working by delegating to the new pipeline.
 */

import type { ParseOptions } from '../ast-builder/options';
import { RuleParserPipeline } from '../ast-builder/rule-parser';
import {
    type AnyRule,
    type InvalidRule,
    type InvalidRuleError,
    NodeType,
    RuleCategory,
} from '../nodes';
import { asError } from '../utils/error';
import { SYNTAX_UNKNOWN } from '../utils/syntax-flags';

/**
 * Legacy parser options, kept for API compatibility with pre-v5 consumers.
 */
export interface LegacyParserOptions {
    /**
     * If `true`, the parser returns an `InvalidRule` node instead of throwing
     * on syntactically invalid input.
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
     * Whether to include raw source parts. Accepted for API compatibility but
     * not used by the v5 pipeline.
     */
    includeRaws?: boolean;

    /**
     * Whether to ignore comment rules. When `true`, comment rules produce
     * `null` instead of a comment AST node.
     */
    ignoreComments?: boolean;

    /**
     * Whether to parse `/etc/hosts`-style host rules.
     */
    parseHostRules?: boolean;
}

/**
 * Default legacy parser options.
 *
 * @deprecated The legacy parser API is a temporary bridge until `@adguard/scriptlets`
 *   migrates to the v5 `RuleParserPipeline`. Prefer `RuleParserPipeline.parse`
 *   for new code.
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
 *
 * @deprecated This class is a temporary bridge until `@adguard/scriptlets`
 *   migrates to the v5 parser. Prefer `RuleParserPipeline.parse` for new code.
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
     * @returns Parsed rule AST node, or `null` when `ignoreComments` is `true`
     *   and the input is a comment rule.
     *
     * @throws If the rule is syntactically invalid and `tolerant` is `false`.
     */
    public static parse(raw: string, options: LegacyParserOptions = defaultParserOptions): AnyRule | null {
        const pipelineOptions: ParseOptions = {
            isLocIncluded: options.isLocIncluded,
            parseAbpSpecificRules: options.parseAbpSpecificRules,
            parseUboSpecificRules: options.parseUboSpecificRules,
            parseHostRules: options.parseHostRules,
        };

        try {
            const result = RuleParser.PIPELINE.parse(raw, pipelineOptions);

            if (options.ignoreComments && result.category === RuleCategory.Comment) {
                return null;
            }

            return result;
        } catch (e: unknown) {
            if (options.tolerant) {
                return RuleParser.createInvalidRule(raw, asError(e), options.isLocIncluded);
            }

            throw e;
        }
    }

    /**
     * Builds an `InvalidRule` node for tolerant-mode failures.
     *
     * @param raw Raw rule source.
     * @param error The error that occurred.
     * @param isLocIncluded Whether to include source location info.
     *
     * @returns InvalidRule AST node.
     */
    private static createInvalidRule(
        raw: string,
        error: Error,
        isLocIncluded?: boolean,
    ): InvalidRule {
        const errNode: InvalidRuleError = {
            type: NodeType.InvalidRuleError,
            name: error.name || 'SyntaxError',
            message: error.message,
        };
        if (isLocIncluded) {
            errNode.start = 0;
            errNode.end = raw.length;
        }
        const result: InvalidRule = {
            type: NodeType.InvalidRule,
            category: RuleCategory.Invalid,
            syntax: SYNTAX_UNKNOWN,
            raw,
            error: errNode,
        };
        if (isLocIncluded) {
            result.start = 0;
            result.end = raw.length;
        }
        return result;
    }
}
