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
import { AdblockSyntaxError } from '../errors/adblock-syntax-error';
import {
    type AnyRule,
    type EmptyRule,
    type InvalidRule,
    type InvalidRuleError,
    NodeType,
    RuleCategory,
} from '../nodes';
import { asError } from '../utils/error';
import { SYNTAX_ALL, SYNTAX_UNKNOWN } from '../utils/syntax-flags';

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
     * Whether to ignore comment rules. When `true`, comment rules produce an
     * `EmptyRule` (with location info, when enabled) instead of a comment node.
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
     * @returns Parsed rule AST node. With `ignoreComments` enabled, comment
     *   rules produce an `EmptyRule` instead of a comment node (matching the
     *   AGTree v4 behavior).
     *
     * @throws If the rule is syntactically invalid and `tolerant` is `false`.
     */
    public static parse(raw: string, options: LegacyParserOptions = defaultParserOptions): AnyRule {
        const pipelineOptions: ParseOptions = {
            isLocIncluded: options.isLocIncluded,
            parseAbpSpecificRules: options.parseAbpSpecificRules,
            parseUboSpecificRules: options.parseUboSpecificRules,
            parseHostRules: options.parseHostRules,
        };

        try {
            const result = RuleParser.PIPELINE.parse(raw, pipelineOptions);

            if (options.ignoreComments && result.category === RuleCategory.Comment) {
                return RuleParser.createEmptyRule(raw, options.isLocIncluded);
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
     * Builds an `EmptyRule` node for ignored comment rules.
     *
     * @param raw Raw rule source.
     * @param isLocIncluded Whether to include source location info.
     *
     * @returns EmptyRule AST node.
     */
    private static createEmptyRule(raw: string, isLocIncluded?: boolean): EmptyRule {
        const result: EmptyRule = {
            type: NodeType.EmptyRule,
            category: RuleCategory.Empty,
            syntax: SYNTAX_ALL,
        };
        if (isLocIncluded) {
            result.start = 0;
            result.end = raw.length;
        }
        return result;
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
            // Preserve the syntax error's own precise span so consumers can
            // highlight the exact offending range, while the outer InvalidRule
            // keeps the full-rule location.
            const { start, end } = RuleParser.getErrorSpan(error, raw.length);
            errNode.start = start;
            errNode.end = end;
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

    /**
     * Extracts the error's own source span, falling back to the full rule span.
     *
     * @param error The error that occurred.
     * @param fallbackEnd Fallback end offset (the raw rule length).
     *
     * @returns The error source span.
     */
    private static getErrorSpan(error: Error, fallbackEnd: number): { start: number; end: number } {
        if (error instanceof AdblockSyntaxError) {
            return { start: error.start, end: error.end };
        }

        return { start: 0, end: fallbackEnd };
    }
}
