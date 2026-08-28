/**
 * @file Types for the filter-list scanner and pipeline.
 */

import type { ParseOptions } from '../ast-builder/options';
import type { RuleKind } from '../parser/classifier';

/**
 * Information about a scanned rule, passed to the scanner callback.
 *
 * The `ParserContext.data` buffer is populated with the structural parse
 * result for this rule and is only valid during the callback invocation.
 */
export interface ScannedRuleInfo {
    /**
     * Structural classification of the rule.
     */
    kind: RuleKind;

    /**
     * Source char offset where rule text starts (inclusive).
     */
    ruleStart: number;

    /**
     * Source char offset where rule text ends (exclusive of newline).
     */
    ruleEnd: number;
}

/**
 * Options for `FilterListPipeline.parse()`.
 *
 * Extends the standard `ParseOptions` with filter-list-specific flags.
 */
export interface FilterListParseOptions extends ParseOptions {
    /**
     * When `true` (default), syntax errors in individual rules produce
     * `InvalidRule` nodes instead of throwing.
     * When `false`, the first syntax error throws immediately.
     */
    tolerant?: boolean;
}
