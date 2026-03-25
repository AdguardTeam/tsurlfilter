/**
 * @file High-level RuleParser — public API wrapping the full pipeline.
 *
 * Owns the tokenizer buffers and preparser context, reusing them across
 * calls for optimal performance.
 */

import {
    type AnyCommentRule,
    type ElementHidingRule,
    type EmptyRule,
    type NetworkRule,
    RuleCategory,
} from '../nodes';
import { createPreparserContext, initPreparserContext } from '../preparser/context';
import type { PreparserContext } from '../preparser/context';
import { RuleKind, RulePreparser } from '../preparser/rule';
import type { TokenizeResult } from '../tokenizer/tokenizer';
import { tokenizeLine } from '../tokenizer/tokenizer';
import { AdblockSyntax } from '../utils/adblockers';

import { CommentAstParser } from './comment/comment';
import { ElementHidingAstParser } from './cosmetic/element-hiding';
import { NetworkRuleAstParser } from './network/network-rule';
import type { PreparserParseOptions } from './network/network-rule';

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
 * Includes element hiding cosmetic rules. Other cosmetic types (CSS injection,
 * scriptlets, etc.) are not yet supported.
 */
// TODO: Use AnyRule from nodes.ts
export type AnyParsedRule = EmptyRule | AnyCommentRule | NetworkRule | ElementHidingRule;

/**
 * High-level parser for adblock rules.
 *
 * Wraps the three-step pipeline (tokenize → preparse → build AST) and
 * reuses internal buffers for performance. Automatically determines whether
 * the input is a comment, network, cosmetic, or empty rule.
 *
 * Element hiding cosmetic rules (##, #@#, #?#, #@?#) are supported. Other
 * cosmetic rule types throw a descriptive error.
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
     * @throws For non-element-hiding cosmetic rules (not yet implemented).
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
                return ElementHidingAstParser.parse(source, this.ctx.data, this.ctx.maxMods, options);

            default:
                throw new Error(`Unknown rule kind: ${kind}`);
        }
    }
}
