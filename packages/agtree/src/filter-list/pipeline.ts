/**
 * @file FilterListPipeline — full pipeline for parsing filter lists into AST.
 *
 * Wraps `FilterListScanner` and dispatches to per-rule AST builders.
 * Supports tolerant mode (invalid rules → `InvalidRule` nodes).
 */

import type { ParserCapacity } from '../ast-builder/capacity';
import { CommentAstBuilder } from '../ast-builder/comment/comment';
import { CssInjectionAstBuilder } from '../ast-builder/cosmetic/css-injection';
import { ElementHidingAstBuilder } from '../ast-builder/cosmetic/element-hiding';
import { HtmlFilteringAstBuilder } from '../ast-builder/cosmetic/html-filtering';
import { JsInjectionAstBuilder } from '../ast-builder/cosmetic/js-injection';
import { ScriptletInjectionAstBuilder } from '../ast-builder/cosmetic/scriptlet-injection';
import { UboCssInjectionAstBuilder } from '../ast-builder/cosmetic/ubo-css-injection';
import { NetworkRuleAstBuilder } from '../ast-builder/network/network-rule';
import type { AnyParsedRule } from '../ast-builder/rule-parser';
import { ProductCode } from '../compatibility-tables/platform';
import {
    type EmptyRule,
    type FilterList,
    type InvalidRule,
    type InvalidRuleError,
    NodeType,
    type RawRule,
    RuleCategory,
} from '../nodes-new';
import type { ParserContext } from '../parser/context';
import {
    CR_FLAG_BODY_ADG_SCRIPTLET,
    CR_FLAG_BODY_UBO_CSS_INJECTION,
    CR_FLAG_BODY_UBO_SCRIPTLET,
    CR_FLAGS_OFFSET,
    CR_SEP_KIND_ABP_SNIPPET,
    CR_SEP_KIND_ADG_CSS_INJECTION,
    CR_SEP_KIND_ADG_HTML_FILTERING,
    CR_SEP_KIND_ADG_JS,
    CR_SEP_KIND_MASK,
    CR_SEP_KIND_SHIFT,
    CR_SEP_KIND_UBO_HTML_FILTERING,
} from '../parser/cosmetic/constants';
import { RuleKind } from '../parser/rule';
import { asError } from '../utils/error';
import { SYNTAX_ALL, SYNTAX_UNKNOWN } from '../utils/syntax-flags';

import { FilterListScanner } from './scanner';
import type { FilterListParseOptions } from './types';

/**
 * When `options.tolerant` is omitted, the pipeline runs in tolerant mode:
 * rules that fail to parse are wrapped in `InvalidRule` nodes instead of
 * propagating the exception to the caller.
 */
const DEFAULT_TOLERANT = true;

/**
 * FilterListPipeline — parses a filter list source into a `FilterList` AST node.
 *
 * Owns a `FilterListScanner` and dispatches to per-rule AST builders.
 *
 * @example
 * ```typescript
 * const pipeline = new FilterListPipeline();
 * const ast = pipeline.parse(source);
 * // ast.children contains all parsed rules
 * ```
 */
export class FilterListPipeline {
    /**
     * Underlying scanner instance.
     */
    private scanner: FilterListScanner;

    /**
     * Creates a new filter list pipeline.
     *
     * @param capacity Optional capacity configuration forwarded to the scanner.
     */
    constructor(capacity?: ParserCapacity) {
        this.scanner = new FilterListScanner(capacity);
    }

    /**
     * Parse a filter list source string into a `FilterList` AST node.
     *
     * @param source Full filter list source string.
     * @param options Parse options (location, tolerant mode, etc.).
     *
     * @returns `FilterList` AST node with all rules as children.
     *
     * @throws If `tolerant` is `false` and a rule has a syntax error.
     */
    public parse(source: string, options?: FilterListParseOptions): FilterList {
        const tolerant = options?.tolerant ?? DEFAULT_TOLERANT;
        const children: AnyParsedRule[] = [];

        // Handle empty source — produce a single EmptyRule.
        if (source.length === 0) {
            children.push(FilterListPipeline.createEmptyRule(0, 0, options));
            return FilterListPipeline.createFilterList(children, source, options);
        }

        this.scanner.scan(
            source,
            (kind: RuleKind, ruleStart: number, ruleEnd: number, ctx: ParserContext) => {
                if (tolerant) {
                    try {
                        children.push(FilterListPipeline.buildRuleAst(kind, ruleStart, ruleEnd, ctx, options));
                    } catch (e: unknown) {
                        children.push(FilterListPipeline.createInvalidRule(
                            source,
                            ruleStart,
                            ruleEnd,
                            asError(e),
                            options,
                        ));
                    }
                } else {
                    children.push(FilterListPipeline.buildRuleAst(kind, ruleStart, ruleEnd, ctx, options));
                }
            },
            (ruleStart: number, ruleEnd: number) => {
                children.push(FilterListPipeline.createEmptyRule(ruleStart, ruleEnd, options));
            },
            tolerant
                ? (e: unknown, ruleStart: number, ruleEnd: number) => {
                    children.push(FilterListPipeline.createInvalidRule(
                        source,
                        ruleStart,
                        ruleEnd,
                        asError(e),
                        options,
                    ));
                }
                : undefined,
            options,
        );

        return FilterListPipeline.createFilterList(children, source, options);
    }

    /**
     * Build an AST node from a scanned rule's ctx.data.
     *
     * @param kind Structural classification of the rule.
     * @param ruleStart Source start offset.
     * @param ruleEnd Source end offset.
     * @param ctx Parser context with populated data.
     * @param options Parse options.
     *
     * @returns Parsed rule AST node.
     */
    private static buildRuleAst(
        kind: RuleKind,
        ruleStart: number,
        ruleEnd: number,
        ctx: ParserContext,
        options?: FilterListParseOptions,
    ): AnyParsedRule {
        const { source } = ctx;

        // Handle ignored rules.
        if (kind === RuleKind.Network && options?.ignoreNetwork) {
            return FilterListPipeline.createIgnoredRule(
                source,
                ruleStart,
                ruleEnd,
                RuleCategory.Network,
                options,
            );
        }
        if (kind === RuleKind.Cosmetic && options?.ignoreCosmetic) {
            return FilterListPipeline.createIgnoredRule(
                source,
                ruleStart,
                ruleEnd,
                RuleCategory.Cosmetic,
                options,
            );
        }

        switch (kind) {
            case RuleKind.Comment: {
                const result = CommentAstBuilder.parse(source, ctx.data, 0, options);
                if (options?.isLocIncluded) {
                    result.start = ruleStart;
                    result.end = ruleEnd;
                }
                return result;
            }

            case RuleKind.Network: {
                const result = NetworkRuleAstBuilder.parse(source, ctx.data, 0, options);
                if (options?.isLocIncluded) {
                    result.start = ruleStart;
                    result.end = ruleEnd;
                }
                return result;
            }

            case RuleKind.Cosmetic: {
                const { data, maxMods, maxDomains } = ctx;
                const result = FilterListPipeline.dispatchCosmetic(source, data, 0, maxMods, maxDomains, options, ctx);
                if (options?.isLocIncluded) {
                    result.start = ruleStart;
                    result.end = ruleEnd;
                }
                return result;
            }

            default: {
                // Exhaustiveness guard — TypeScript should catch this at compile time.
                const unhandled: never = kind;
                throw new Error(`Unknown rule kind: ${unhandled}`);
            }
        }
    }

    /**
     * Dispatch cosmetic rules to the correct AST builder.
     * Mirrors `RuleParserPipeline.dispatchCosmetic`.
     *
     * @param source Source string.
     * @param data Parsed data buffer.
     * @param dataOffset Offset within `data` where the cosmetic rule header starts.
     * @param maxMods Maximum modifier capacity used during parsing.
     * @param maxDomains Maximum domain capacity used during parsing.
     * @param options Parse options.
     * @param ctx Optional parser context forwarded to builders that can
     *   perform direct token-based sub-parsing without re-tokenization.
     *
     * @returns Parsed cosmetic rule AST node.
     */
    private static dispatchCosmetic(
        source: string,
        data: Int32Array,
        dataOffset: number,
        maxMods: number,
        maxDomains: number,
        options?: FilterListParseOptions,
        ctx?: ParserContext,
    ) {
        const flags = data[dataOffset + CR_FLAGS_OFFSET];
        const sepKind = (flags >>> CR_SEP_KIND_SHIFT) & CR_SEP_KIND_MASK;

        // #%# / #@%# — ADG scriptlet or JS injection
        if (sepKind === CR_SEP_KIND_ADG_JS) {
            if (flags & CR_FLAG_BODY_ADG_SCRIPTLET) {
                // eslint-disable-next-line max-len
                return ScriptletInjectionAstBuilder.parse(source, data, dataOffset, maxMods, maxDomains, ProductCode.Adg, options);
            }
            return JsInjectionAstBuilder.parse(source, data, dataOffset, maxMods, options);
        }

        // #$# / #@$# / #$?# / #@$?# — ADG CSS injection
        if (sepKind === CR_SEP_KIND_ADG_CSS_INJECTION) {
            return CssInjectionAstBuilder.parse(source, data, dataOffset, maxMods, maxDomains, options, ctx);
        }

        // $$ / $@$ — ADG HTML filtering
        if (sepKind === CR_SEP_KIND_ADG_HTML_FILTERING) {
            return HtmlFilteringAstBuilder.parse(source, data, dataOffset, maxMods, options);
        }

        // ## / #@# with ^ prefix — uBO HTML filtering
        if (sepKind === CR_SEP_KIND_UBO_HTML_FILTERING) {
            return HtmlFilteringAstBuilder.parse(source, data, dataOffset, maxMods, options);
        }

        // #$# / #@$# — ABP snippet injection
        if (sepKind === CR_SEP_KIND_ABP_SNIPPET) {
            if (options?.parseAbpSpecificRules === false) {
                throw new Error('ABP snippet rules are disabled by parseAbpSpecificRules option');
            }
            // eslint-disable-next-line max-len
            return ScriptletInjectionAstBuilder.parse(source, data, dataOffset, maxMods, maxDomains, ProductCode.Abp, options);
        }

        // ## / #@# / #?# / #@?# — element hiding or uBO scriptlet
        if (flags & CR_FLAG_BODY_UBO_SCRIPTLET) {
            if (options?.parseUboSpecificRules === false) {
                throw new Error('uBO scriptlet rules are disabled by parseUboSpecificRules option');
            }
            // eslint-disable-next-line max-len
            return ScriptletInjectionAstBuilder.parse(source, data, dataOffset, maxMods, maxDomains, ProductCode.Ubo, options);
        }

        // ## / #@# / #?# / #@?# with :style() or :remove() body — uBO CSS injection
        if (flags & CR_FLAG_BODY_UBO_CSS_INJECTION) {
            return UboCssInjectionAstBuilder.parse(source, data, dataOffset, maxMods, maxDomains, options);
        }

        // Default: element hiding
        return ElementHidingAstBuilder.parse(source, data, dataOffset, maxMods, options);
    }

    /**
     * Create an EmptyRule node.
     *
     * @param start Source start offset.
     * @param end Source end offset.
     * @param options Parse options.
     *
     * @returns EmptyRule AST node.
     */
    private static createEmptyRule(
        start: number,
        end: number,
        options?: FilterListParseOptions,
    ): EmptyRule {
        const result: EmptyRule = {
            type: NodeType.EmptyRule,
            category: RuleCategory.Empty,
            syntax: SYNTAX_ALL,
        };
        if (options?.isLocIncluded) {
            result.start = start;
            result.end = end;
        }
        return result;
    }

    /**
     * Create an InvalidRule node from an error.
     *
     * @param source Full source string.
     * @param ruleStart Start offset of the rule in `source`.
     * @param ruleEnd End offset of the rule in `source`.
     * @param error The error that occurred.
     * @param options Parse options.
     *
     * @returns InvalidRule AST node.
     */
    private static createInvalidRule(
        source: string,
        ruleStart: number,
        ruleEnd: number,
        error: Error,
        options?: FilterListParseOptions,
    ): InvalidRule {
        const errNode: InvalidRuleError = {
            type: NodeType.InvalidRuleError,
            name: error.name || 'SyntaxError',
            message: error.message,
        };
        if (options?.isLocIncluded) {
            errNode.start = ruleStart;
            errNode.end = ruleEnd;
        }
        const result: InvalidRule = {
            type: NodeType.InvalidRule,
            category: RuleCategory.Invalid,
            syntax: SYNTAX_UNKNOWN,
            raw: source.slice(ruleStart, ruleEnd),
            error: errNode,
        };
        if (options?.isLocIncluded) {
            result.start = ruleStart;
            result.end = ruleEnd;
        }
        return result;
    }

    /**
     * Create an ignored rule (for `ignoreNetwork` / `ignoreCosmetic` options).
     *
     * @param source Full source string.
     * @param start Source start offset.
     * @param end Source end offset.
     * @param kind The rule kind detected before parsing was skipped.
     * @param options Parse options.
     *
     * @returns RawRule AST node.
     */
    private static createIgnoredRule(
        source: string,
        start: number,
        end: number,
        kind: typeof RuleCategory.Network | typeof RuleCategory.Cosmetic,
        options?: FilterListParseOptions,
    ): RawRule {
        const result: RawRule = {
            type: NodeType.RawRule,
            category: RuleCategory.Raw,
            syntax: SYNTAX_UNKNOWN,
            raw: source.slice(start, end),
            kind,
        };
        if (options?.isLocIncluded) {
            result.start = start;
            result.end = end;
        }
        return result;
    }

    /**
     * Create the final FilterList node.
     *
     * @param children Child rule nodes.
     * @param source Full source string.
     * @param options Parse options.
     *
     * @returns FilterList AST node.
     */
    private static createFilterList(
        children: AnyParsedRule[],
        source: string,
        options?: FilterListParseOptions,
    ): FilterList {
        const result: FilterList = {
            type: NodeType.FilterList,
            // AnyParsedRule is a structural subset of AnyRule, so the cast is safe.
            children: children as FilterList['children'],
        };
        if (options?.isLocIncluded) {
            result.start = 0;
            result.end = source.length;
        }
        return result;
    }

    /**
     * Release any extra memory grown during previous parses.
     * Shrinks all buffers back to constructor-time defaults.
     */
    public reset(): void {
        this.scanner.reset();
    }
}
