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
    CommentMarker,
    type EmptyRule,
    type InvalidRule,
    type InvalidRuleError,
    NodeType,
    RuleCategory,
} from '../nodes';
import { CosmeticRuleSeparatorUtils } from '../utils/cosmetic-rule-separator';
import { StringUtils } from '../utils/string';
import { SYNTAX_ALL, SYNTAX_UNKNOWN } from '../utils/syntax-flags';
import { walk } from '../walker';

/**
 * Callback function type for handling parse errors in tolerant mode.
 */
export type OnParseError = (error: unknown) => void;

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

    /**
     * Whether to parse HTML filtering rule bodies with the CSS selector list
     * parser. When `false` (the default), the body is stored as raw
     * start/end offsets. Forwarded to the v5 pipeline.
     */
    parseHtmlFilteringRuleBodies?: boolean;

    /**
     * Callback invoked when tolerant mode catches a parse error. Mirrors the
     * AGTree v4 `onParseError` option.
     */
    onParseError?: OnParseError;
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
    parseHtmlFilteringRuleBodies: false,
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
     * @param baseOffset Starting offset of the input. Node locations are
     *   calculated relative to this offset (mirrors AGTree v4).
     *
     * @returns Parsed rule AST node. With `ignoreComments` enabled, comment
     *   rules produce an `EmptyRule` instead of a comment node (matching the
     *   AGTree v4 behavior).
     *
     * @throws If the rule is syntactically invalid and `tolerant` is `false`.
     */
    public static parse(
        raw: string,
        options: LegacyParserOptions = defaultParserOptions,
        baseOffset = 0,
    ): AnyRule {
        // Empty input and ignored comment rules short-circuit before the full
        // pipeline parse, so malformed comment bodies (e.g. an unclosed `!#if`)
        // are not validated when they are ignored — matching AGTree v4.
        if (raw.trim().length === 0) {
            return RuleParser.createEmptyRule(raw, options.isLocIncluded, baseOffset);
        }

        if (options.ignoreComments && RuleParser.isCommentRule(raw)) {
            return RuleParser.createEmptyRule(raw, options.isLocIncluded, baseOffset);
        }

        const pipelineOptions: ParseOptions = {
            isLocIncluded: options.isLocIncluded,
            parseAbpSpecificRules: options.parseAbpSpecificRules,
            parseUboSpecificRules: options.parseUboSpecificRules,
            parseHostRules: options.parseHostRules,
            parseHtmlFilteringRuleBodies: options.parseHtmlFilteringRuleBodies,
        };

        try {
            const result = RuleParser.PIPELINE.parse(raw, pipelineOptions);

            if (baseOffset === 0 || !options.isLocIncluded) {
                return result;
            }

            return RuleParser.offsetLocations(result, baseOffset);
        } catch (e: unknown) {
            if (!options.tolerant || !(e instanceof Error)) {
                throw e;
            }

            if (options.onParseError) {
                options.onParseError(e);
            }

            return RuleParser.createInvalidRule(raw, e, options.isLocIncluded, baseOffset);
        }
    }

    /**
     * Shifts every node location in the parsed tree by the given offset,
     * mirroring how AGTree v4 parsers computed locations relative to the
     * supplied `baseOffset`.
     *
     * @param root Parsed rule node.
     * @param offset Offset to add to each `start`/`end` location.
     *
     * @returns The same root node (mutated in place).
     */
    private static offsetLocations(root: AnyRule, offset: number): AnyRule {
        walk(root, {
            enter: (node) => {
                if (typeof node.start === 'number') {
                    // eslint-disable-next-line no-param-reassign
                    node.start += offset;
                }
                if (typeof node.end === 'number') {
                    // eslint-disable-next-line no-param-reassign
                    node.end += offset;
                }
            },
        });

        return root;
    }

    /**
     * Checks whether the rule is a comment rule using the same cheap marker
     * heuristics as AGTree v4 (`CommentParser.isCommentRule`), so ignored
     * comments can be short-circuited before a full parse.
     *
     * @param raw Raw rule source.
     *
     * @returns True when the rule is a comment rule.
     */
    private static isCommentRule(raw: string): boolean {
        const trimmed = raw.trim();

        // `!` comments (regular, metadata, preprocessor, hint, config).
        if (trimmed.startsWith(CommentMarker.Regular)) {
            return true;
        }

        // `#` comments (uBO host-style), unless the `#` introduces a valid
        // cosmetic-rule separator followed by a selector.
        if (trimmed.startsWith(CommentMarker.Hashmark)) {
            const separator = CosmeticRuleSeparatorUtils.find(trimmed);

            if (separator === null) {
                return true;
            }

            const charAfterSeparator = trimmed[separator.end];

            return !charAfterSeparator
                || StringUtils.isWhitespace(charAfterSeparator)
                || (
                    charAfterSeparator === CommentMarker.Hashmark
                    && trimmed[separator.end + 1] === CommentMarker.Hashmark
                );
        }

        // `[...]` agent comments, unless they contain a cosmetic separator.
        if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
            return CosmeticRuleSeparatorUtils.find(trimmed) === null;
        }

        return false;
    }

    /**
     * Builds an `EmptyRule` node for empty or ignored comment input.
     *
     * @param raw Raw rule source.
     * @param isLocIncluded Whether to include source location info.
     * @param baseOffset Starting offset of the input.
     *
     * @returns EmptyRule AST node.
     */
    private static createEmptyRule(raw: string, isLocIncluded?: boolean, baseOffset = 0): EmptyRule {
        const result: EmptyRule = {
            type: NodeType.EmptyRule,
            category: RuleCategory.Empty,
            syntax: SYNTAX_ALL,
        };
        if (isLocIncluded) {
            result.start = baseOffset;
            result.end = baseOffset + raw.length;
        }
        return result;
    }

    /**
     * Builds an `InvalidRule` node for tolerant-mode failures.
     *
     * @param raw Raw rule source.
     * @param error The error that occurred.
     * @param isLocIncluded Whether to include source location info.
     * @param baseOffset Starting offset of the input.
     *
     * @returns InvalidRule AST node.
     */
    private static createInvalidRule(
        raw: string,
        error: Error,
        isLocIncluded?: boolean,
        baseOffset = 0,
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
            result.start = baseOffset;
            result.end = baseOffset + raw.length;
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
