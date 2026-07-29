/**
 * @file High-level RuleParser — public API wrapping the full pipeline.
 *
 * Owns the tokenizer buffers and parser context, reusing them across
 * calls for optimal performance.
 */

import { ProductCode } from '../compatibility-tables/platform';
import {
    CapacityOverflowError,
    REGION_DOMAINS,
    REGION_MODIFIERS,
    REGION_SCRIPTLET_BODY,
    REGION_TOKENS,
} from '../errors/capacity-overflow-error';
import type { CapacityRegion } from '../errors/capacity-overflow-error';
import {
    MAX_DOMAIN_CAPACITY,
    MAX_MODIFIER_CAPACITY,
    MAX_SCRIPTLET_BODY_CAPACITY,
    MAX_TOKEN_CAPACITY,
} from '../limits';
import {
    type AnyCommentRule,
    type CssInjectionRule,
    type ElementHidingRule,
    type EmptyRule,
    type HostRule,
    type HtmlFilteringRule,
    type InvalidRule,
    type JsInjectionRule,
    type NetworkRule,
    NodeType,
    type RawRule,
    RuleCategory,
    type ScriptletInjectionRule,
} from '../nodes';
import {
    createParserContext,
    CTX_STATUS_HARD_CAP,
    CTX_STATUS_OK,
    CTX_STATUS_OVERFLOW,
    initParserContext,
    resetCtxData,
} from '../parser/context';
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
import { RuleKind, RuleParser } from '../parser/rule';
import { Tokenizer } from '../tokenizer/tokenizer';
import { SYNTAX_ALL, SYNTAX_UNKNOWN } from '../utils/syntax-flags';

import type { ParserCapacity } from './capacity';
import { CommentAstBuilder } from './comment/comment';
import { CssInjectionAstBuilder } from './cosmetic/css-injection';
import { ElementHidingAstBuilder } from './cosmetic/element-hiding';
import { HtmlFilteringAstBuilder } from './cosmetic/html-filtering';
import { JsInjectionAstBuilder } from './cosmetic/js-injection';
import { ScriptletInjectionAstBuilder } from './cosmetic/scriptlet-injection';
import { UboCssInjectionAstBuilder } from './cosmetic/ubo-css-injection';
import { HostRuleAstBuilder } from './network/host-rule';
import { NetworkRuleAstBuilder } from './network/network-rule';
import type { ParseOptions } from './options';

/**
 * Default maximum number of tokens per rule.
 * Handles both network and comment rules with varying complexity.
 */
const DEFAULT_TOKEN_CAPACITY = 1024;

/**
 * Default maximum number of children (modifiers, hints, or agents) per rule.
 * Supports complex network rules with many modifiers or multi-agent comments.
 */
const DEFAULT_CHILDREN_CAPACITY = 64;

/**
 * Default maximum number of domains per cosmetic rule.
 * Handles common real-world filter lists.
 */
const DEFAULT_DOMAIN_CAPACITY = 128;

/**
 * Error message emitted when the token buffer reaches the hard cap with growth disabled.
 */
const ERR_TOKEN_BUFFER_OVERFLOW = 'Parser token buffer overflow: rule too large for current capacity';

/**
 * Error message emitted when the data buffer overflows after a successful tokenizer pass.
 */
const ERR_DATA_BUFFER_OVERFLOW = 'Parser data buffer overflow: rule too large for current capacity';

/**
 * Get the hard cap for a given capacity region.
 *
 * @param region The overflow region.
 *
 * @returns The corresponding hard cap constant.
 */
function hardCapForRegion(region: CapacityRegion): number {
    switch (region) {
        case REGION_TOKENS: return MAX_TOKEN_CAPACITY;
        case REGION_MODIFIERS: return MAX_MODIFIER_CAPACITY;
        case REGION_DOMAINS: return MAX_DOMAIN_CAPACITY;
        case REGION_SCRIPTLET_BODY: return MAX_SCRIPTLET_BODY_CAPACITY;
        default: {
            // Exhaustiveness guard: TypeScript will error here if CapacityRegion gains a new member.
            const unhandled: never = region;
            throw new Error(`Unhandled capacity region: ${unhandled}`);
        }
    }
}

/**
 * The set of rule types that this parser currently produces.
 */
// TODO: Use AnyRule from nodes.ts
export type AnyParsedRule =
    | EmptyRule
    | RawRule
    | InvalidRule
    | AnyCommentRule
    | HostRule
    | NetworkRule
    | ElementHidingRule
    | CssInjectionRule
    | ScriptletInjectionRule
    | JsInjectionRule
    | HtmlFilteringRule;

/**
 * Creates a RawRule node for a rule that was intentionally skipped
 * by the `ignoreCosmetic` or `ignoreNetwork` option.
 *
 * @param source Rule source text.
 * @param kind The rule kind detected before parsing was skipped.
 * @param options Parse options (for location).
 * @param start Source start offset (default 0).
 * @param end Source end offset (default source.length).
 *
 * @returns RawRule AST node.
 */
function createIgnoredRule(
    source: string,
    kind: typeof RuleCategory.Network | typeof RuleCategory.Cosmetic,
    options?: ParseOptions,
    start = 0,
    end = source.length,
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
 * High-level parser for adblock rules.
 *
 * Wraps the three-step pipeline (tokenize → parse → build AST) and
 * reuses internal buffers for performance. Automatically determines whether
 * the input is a comment, network, cosmetic, or empty rule.
 *
 * Supported cosmetic rule types:
 * - Element hiding (##, #@#, #?#, #@?#)
 * - Scriptlet injection (ADG #%#//scriptlet, UBO ##+js, ABP #$#)
 * - JS injection (ADG #%# without //scriptlet prefix).
 *
 * @example
 * ```typescript
 * const parser = new RuleParser();
 * const ast = parser.parse('||example.org^$script');   // NetworkRule
 * const cmt = parser.parse('! Title: My List');        // MetadataCommentRule
 * const emp = parser.parse('');                        // EmptyRule
 * ```
 */
export class RuleParserPipeline {
    /**
     * Tokenizer instance.
     */
    private tokenizer: Tokenizer;

    /**
     * Parser context.
     */
    private ctx: ParserContext;

    /**
     * Whether buffers may grow dynamically on overflow.
     */
    private grow: boolean;

    /**
     * Default modifier capacity (used by {@link reset} to restore original size).
     */
    private defaultItemCap: number;

    /**
     * Default domain capacity (used by {@link reset} to restore original size).
     */
    private defaultDomainCap: number;

    /**
     * Default scriptlet body capacity (used by {@link reset} to restore original size).
     */
    private defaultScriptletCap: number;

    /**
     * Creates a new rule parser.
     *
     * @param capacity Optional capacity configuration.
     */
    constructor(capacity?: ParserCapacity) {
        const tokenCap = capacity?.tokenCapacity ?? DEFAULT_TOKEN_CAPACITY;
        const itemCap = capacity?.itemCapacity ?? DEFAULT_CHILDREN_CAPACITY;
        const domainCap = capacity?.secondaryCapacity ?? DEFAULT_DOMAIN_CAPACITY;
        this.grow = capacity?.grow ?? true;
        this.defaultItemCap = itemCap;
        this.defaultDomainCap = domainCap;
        this.tokenizer = new Tokenizer(tokenCap);
        const scriptletCap = undefined; // use default (SCRIPTLET_BODY_DATA_CAPACITY)
        this.ctx = createParserContext(tokenCap, itemCap, domainCap, scriptletCap, this.grow);
        this.defaultScriptletCap = this.ctx.maxScriptletBody;
    }

    /**
     * Release any extra memory that was grown during previous parses and
     * reset internal state so the parser is ready for a new filter list.
     *
     * After calling this method, the parser's tokenizer and context buffers
     * shrink back to their constructor-supplied default capacities. Call this
     * at filter-list boundaries to prevent unbounded memory growth when
     * processing rules with unusually large domain/modifier lists.
     *
     * It is safe to call this method at any time — including before the first
     * parse or multiple times in a row.
     */
    public reset(): void {
        this.tokenizer.reset();
        resetCtxData(this.ctx, this.defaultItemCap, this.defaultDomainCap, this.defaultScriptletCap);
    }

    /**
     * Parse an adblock rule string into an AST node.
     *
     * @param source Rule source string.
     * @param options Parsing options (location, raws).
     *
     * @returns Parsed rule AST node.
     *
     * @throws For unsupported cosmetic rule types.
     */
    public parse(source: string, options?: ParseOptions): AnyParsedRule {
        if (source.trim().length === 0) {
            const result: EmptyRule = {
                type: NodeType.EmptyRule,
                category: RuleCategory.Empty,
                syntax: SYNTAX_ALL,
            };

            if (options?.isLocIncluded) {
                result.start = 0;
                result.end = source.length;
            }

            return result;
        }

        this.tokenizer.source = source;
        this.tokenizer.offset = 0;
        this.tokenizer.tokenize();

        // If the tokenizer didn't reach the end of the source, the buffer
        // was exhausted. Grow and retokenize from scratch (offset = 0) until
        // the full source is consumed or we hit the hard cap.
        while (this.tokenizer.offset < source.length) {
            if (!this.grow) {
                throw new Error(ERR_TOKEN_BUFFER_OVERFLOW);
            }
            const requested = Math.min(this.tokenizer.types.length * 2, MAX_TOKEN_CAPACITY);
            if (requested <= this.tokenizer.types.length) {
                throw new CapacityOverflowError(REGION_TOKENS, requested, MAX_TOKEN_CAPACITY);
            }
            this.tokenizer.growCapacity(requested);
            this.tokenizer.offset = 0;
            this.tokenizer.tokenize();
        }

        initParserContext(this.ctx, source, this.tokenizer);

        // eslint-disable-next-line max-len
        const kind = RuleParser.parse(this.ctx, 0, this.ctx.tokenCount, 0, options);

        // Surface structural overflow.
        if (this.ctx.status === CTX_STATUS_HARD_CAP) {
            const { overflowRegion } = this.ctx;
            this.ctx.status = CTX_STATUS_OK;
            this.ctx.overflowRegion = undefined;
            const region = overflowRegion ?? REGION_TOKENS;
            throw new CapacityOverflowError(region, hardCapForRegion(region) + 1, hardCapForRegion(region));
        }
        if (this.ctx.status === CTX_STATUS_OVERFLOW) {
            this.ctx.status = CTX_STATUS_OK;
            throw new Error(ERR_DATA_BUFFER_OVERFLOW);
        }

        if (kind === RuleKind.Network && options?.ignoreNetwork) {
            return createIgnoredRule(source, RuleCategory.Network, options);
        }
        if (kind === RuleKind.Cosmetic && options?.ignoreCosmetic) {
            return createIgnoredRule(source, RuleCategory.Cosmetic, options);
        }

        switch (kind) {
            case RuleKind.Comment:
                return CommentAstBuilder.parse(source, this.ctx.data, 0, options);

            case RuleKind.Network:
                if (options?.parseHostRules && HostRuleAstBuilder.isCandidate(this.ctx)) {
                    const hostRule = HostRuleAstBuilder.parse(source, options);
                    if (hostRule) {
                        return hostRule;
                    }
                }
                return NetworkRuleAstBuilder.parse(source, this.ctx.data, 0, options);

            case RuleKind.Cosmetic: {
                const { data, maxMods, maxDomains } = this.ctx;
                return RuleParserPipeline.dispatchCosmetic(source, data, 0, maxMods, maxDomains, options, this.ctx);
            }

            default:
                throw new Error(`Unknown rule kind: ${kind}`);
        }
    }

    /**
     * Dispatch cosmetic rules to the correct AST builder based on integer
     * flags in the data buffer. No string operations — all dispatch
     * decisions use bit flags from `data[CR_FLAGS_OFFSET]`.
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
    // eslint-disable-next-line no-bitwise
    private static dispatchCosmetic(
        source: string,
        data: Int32Array,
        dataOffset: number,
        maxMods: number,
        maxDomains: number,
        options?: ParseOptions,
        ctx?: ParserContext,
    ): ElementHidingRule | CssInjectionRule | ScriptletInjectionRule | JsInjectionRule | HtmlFilteringRule {
        // Read flags set by the parser — all dispatch is integer-only
        // eslint-disable-next-line no-bitwise
        const flags = data[dataOffset + CR_FLAGS_OFFSET];
        // eslint-disable-next-line no-bitwise
        const sepKind = (flags >>> CR_SEP_KIND_SHIFT) & CR_SEP_KIND_MASK;

        // #%# / #@%# — ADG scriptlet or JS injection
        if (sepKind === CR_SEP_KIND_ADG_JS) {
            // eslint-disable-next-line no-bitwise
            if (flags & CR_FLAG_BODY_ADG_SCRIPTLET) {
                // eslint-disable-next-line max-len
                return ScriptletInjectionAstBuilder.parse(source, data, dataOffset, maxMods, maxDomains, ProductCode.Adg, options);
            }
            return JsInjectionAstBuilder.parse(source, data, dataOffset, maxMods, options);
        }

        // #$# / #@$# / #$?# / #@$?# — ADG CSS injection (body contains CSS block)
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
        // (sepKind === CR_SEP_KIND_ELEMENT_HIDING, which is 0 / default)
        // eslint-disable-next-line no-bitwise
        if (flags & CR_FLAG_BODY_UBO_SCRIPTLET) {
            if (options?.parseUboSpecificRules === false) {
                throw new Error('uBO scriptlet rules are disabled by parseUboSpecificRules option');
            }
            // eslint-disable-next-line max-len
            return ScriptletInjectionAstBuilder.parse(source, data, dataOffset, maxMods, maxDomains, ProductCode.Ubo, options);
        }

        // ## / #@# / #?# / #@?# with :style() or :remove() body — uBO CSS injection
        // eslint-disable-next-line no-bitwise
        if (flags & CR_FLAG_BODY_UBO_CSS_INJECTION) {
            return UboCssInjectionAstBuilder.parse(source, data, dataOffset, maxMods, maxDomains, options);
        }

        // Default: element hiding
        return ElementHidingAstBuilder.parse(source, data, dataOffset, maxMods, options);
    }

    /**
     * Parse a sub-range of an already-tokenized context into a rule AST node.
     *
     * The caller must have already run the tokenizer and `initParserContext`
     * so that `ctx` is fully populated. This method runs the structural parser
     * over the specified token range and builds the AST.
     *
     * @param ctx Parser context with tokenizer output already loaded.
     * @param startTi Inclusive start token index.
     * @param endTi Exclusive end token index.
     * @param dataOffset Offset within ctx.data to write structural data.
     * @param options Parsing options (location, raws).
     *
     * @returns Parsed rule AST node.
     */
    // eslint-disable-next-line class-methods-use-this
    public parseRange(
        ctx: ParserContext,
        startTi: number,
        endTi: number,
        dataOffset: number,
        options?: ParseOptions,
    ): AnyParsedRule {
        const kind = RuleParser.parse(
            ctx,
            startTi,
            endTi,
            dataOffset,
            options,
        );

        // Surface structural overflow loudly (see RuleParserPipeline.parse).
        if (ctx.status === CTX_STATUS_HARD_CAP) {
            const { overflowRegion } = ctx;
            ctx.status = CTX_STATUS_OK;
            ctx.overflowRegion = undefined;
            const region = overflowRegion ?? REGION_TOKENS;
            throw new CapacityOverflowError(region, hardCapForRegion(region) + 1, hardCapForRegion(region));
        }
        if (ctx.status === CTX_STATUS_OVERFLOW) {
            ctx.status = CTX_STATUS_OK;
            throw new Error(ERR_DATA_BUFFER_OVERFLOW);
        }

        const ruleStart = startTi > 0 ? ctx.ends[startTi - 1] : ctx.sourceStart;
        const ruleEnd = endTi > 0 ? ctx.ends[endTi - 1] : ctx.sourceStart;

        if (kind === RuleKind.Network && options?.ignoreNetwork) {
            return createIgnoredRule(ctx.source, RuleCategory.Network, options, ruleStart, ruleEnd);
        }
        if (kind === RuleKind.Cosmetic && options?.ignoreCosmetic) {
            return createIgnoredRule(ctx.source, RuleCategory.Cosmetic, options, ruleStart, ruleEnd);
        }

        switch (kind) {
            case RuleKind.Comment: {
                const result = CommentAstBuilder.parse(ctx.source, ctx.data, dataOffset, options);
                if (options?.isLocIncluded) {
                    result.start = ruleStart;
                    result.end = ruleEnd;
                }
                return result;
            }

            case RuleKind.Network: {
                const result = NetworkRuleAstBuilder.parse(ctx.source, ctx.data, dataOffset, options);
                if (options?.isLocIncluded) {
                    result.start = ruleStart;
                    result.end = ruleEnd;
                }
                return result;
            }

            case RuleKind.Cosmetic: {
                const { source: src, maxMods, maxDomains } = ctx;
                // eslint-disable-next-line max-len
                const result = RuleParserPipeline.dispatchCosmetic(src, ctx.data, dataOffset, maxMods, maxDomains, options, ctx);
                if (options?.isLocIncluded) {
                    result.start = ruleStart;
                    result.end = ruleEnd;
                }
                return result;
            }

            default:
                throw new Error(`Unknown rule kind: ${kind}`);
        }
    }
}
