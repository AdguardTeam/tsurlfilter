/**
 * @file High-level RuleParser — public API wrapping the full pipeline.
 *
 * Owns the tokenizer buffers and preparser context, reusing them across
 * calls for optimal performance.
 */

import { ProductCode } from '../compatibility-tables/platform';
import {
    type AnyCommentRule,
    type ElementHidingRule,
    type EmptyRule,
    type JsInjectionRule,
    type NetworkRule,
    RuleCategory,
    type ScriptletInjectionRule,
} from '../nodes-new';
import { createPreparserContext, initPreparserContext } from '../preparser/context';
import type { PreparserContext } from '../preparser/context';
import {
    CR_FLAG_BODY_ADG_SCRIPTLET,
    CR_FLAG_BODY_UBO_SCRIPTLET,
    CR_FLAGS_OFFSET,
    CR_SEP_KIND_ABP_SNIPPET,
    CR_SEP_KIND_ADG_JS,
    CR_SEP_KIND_MASK,
    CR_SEP_KIND_SHIFT,
} from '../preparser/cosmetic/constants';
import { RuleKind, RulePreparser } from '../preparser/rule';
import type { TokenizeResult } from '../tokenizer/tokenizer';
import { tokenizeLine } from '../tokenizer/tokenizer';
import { AdblockSyntax } from '../utils/adblockers';

import { CommentAstParser } from './comment/comment';
import { ElementHidingAstParser } from './cosmetic/element-hiding';
import { JsInjectionAstParser } from './cosmetic/js-injection';
import { ScriptletInjectionAstParser } from './cosmetic/scriptlet-injection';
import { NetworkRuleAstParser } from './network/network-rule';
import type { PreparserParseOptions } from './options';

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
 * The set of rule types that this parser currently produces.
 */
// TODO: Use AnyRule from nodes.ts
export type AnyParsedRule =
    | EmptyRule
    | AnyCommentRule
    | NetworkRule
    | ElementHidingRule
    | ScriptletInjectionRule
    | JsInjectionRule;

/**
 * High-level parser for adblock rules.
 *
 * Wraps the three-step pipeline (tokenize → preparse → build AST) and
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
export class RuleParser {
    /**
     * Tokenize result buffer.
     */
    private tokens: TokenizeResult;

    /**
     * Preparser context.
     */
    private ctx: PreparserContext;

    /**
     * Creates a new rule parser.
     *
     * @param tokenCapacity Maximum number of tokens per rule.
     * @param childrenCapacity Maximum modifiers / hints / agents per rule.
     */
    constructor(
        tokenCapacity = DEFAULT_TOKEN_CAPACITY,
        childrenCapacity = DEFAULT_CHILDREN_CAPACITY,
    ) {
        this.tokens = {
            tokenCount: 0,
            types: new Uint8Array(tokenCapacity),
            ends: new Uint32Array(tokenCapacity),
            actualEnd: 0,
            overflowed: 0,
        };
        this.ctx = createPreparserContext(tokenCapacity, childrenCapacity);
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
    public parse(source: string, options?: PreparserParseOptions): AnyParsedRule {
        if (source.trim().length === 0) {
            const result: EmptyRule = {
                type: 'EmptyRule',
                category: RuleCategory.Empty,
                syntax: AdblockSyntax.Common,
            };

            if (options?.includeRaws) {
                result.raws = { text: source };
            }

            if (options?.isLocIncluded) {
                result.start = 0;
                result.end = source.length;
            }

            return result;
        }

        tokenizeLine(source, 0, this.tokens);
        initPreparserContext(this.ctx, source, this.tokens);

        const kind = RulePreparser.preparse(this.ctx, options?.parseUboSpecificRules ?? true);

        switch (kind) {
            case RuleKind.Comment:
                return CommentAstParser.parse(source, this.ctx.data, options);

            case RuleKind.Network:
                return NetworkRuleAstParser.parse(source, this.ctx.data, options);

            case RuleKind.Cosmetic:
                return this.dispatchCosmetic(source, options);

            default:
                throw new Error(`Unknown rule kind: ${kind}`);
        }
    }

    /**
     * Dispatch cosmetic rules to the correct AST parser based on integer
     * flags set by the preparser. No string operations — all dispatch
     * decisions use bit flags from ctx.data[CR_FLAGS_OFFSET].
     *
     * @param source Source string.
     * @param options Parse options.
     *
     * @returns Parsed cosmetic rule AST node.
     */
    // eslint-disable-next-line no-bitwise
    private dispatchCosmetic(
        source: string,
        options?: PreparserParseOptions,
    ): ElementHidingRule | ScriptletInjectionRule | JsInjectionRule {
        const { data, maxMods, maxDomains } = this.ctx;

        // Read flags set by the preparser — all dispatch is integer-only
        // eslint-disable-next-line no-bitwise
        const flags = data[CR_FLAGS_OFFSET];
        // eslint-disable-next-line no-bitwise
        const sepKind = (flags >>> CR_SEP_KIND_SHIFT) & CR_SEP_KIND_MASK;

        // #%# / #@%# — ADG scriptlet or JS injection
        if (sepKind === CR_SEP_KIND_ADG_JS) {
            // eslint-disable-next-line no-bitwise
            if (flags & CR_FLAG_BODY_ADG_SCRIPTLET) {
                return ScriptletInjectionAstParser.parse(source, data, maxMods, maxDomains, ProductCode.Adg, options);
            }
            return JsInjectionAstParser.parse(source, data, maxMods, options);
        }

        // #$# / #@$# — ABP snippet injection
        if (sepKind === CR_SEP_KIND_ABP_SNIPPET) {
            if (options?.parseAbpSpecificRules === false) {
                throw new Error('ABP snippet rules are disabled by parseAbpSpecificRules option');
            }
            return ScriptletInjectionAstParser.parse(source, data, maxMods, maxDomains, ProductCode.Abp, options);
        }

        // ## / #@# / #?# / #@?# — element hiding or uBO scriptlet
        // (sepKind === CR_SEP_KIND_ELEMENT_HIDING, which is 0 / default)
        // eslint-disable-next-line no-bitwise
        if (flags & CR_FLAG_BODY_UBO_SCRIPTLET) {
            if (options?.parseUboSpecificRules === false) {
                throw new Error('uBO scriptlet rules are disabled by parseUboSpecificRules option');
            }
            return ScriptletInjectionAstParser.parse(source, data, maxMods, maxDomains, ProductCode.Ubo, options);
        }

        // Default: element hiding
        return ElementHidingAstParser.parse(source, data, maxMods, options);
    }
}
