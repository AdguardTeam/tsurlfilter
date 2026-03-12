/**
 * @file High-level RuleParser — public API wrapping the full pipeline.
 *
 * Owns the tokenizer buffers and preparser context, reusing them across
 * calls for optimal performance.
 */

import { AdblockSyntax } from '../utils/adblockers';
import { tokenizeLine } from '../tokenizer/tokenizer';
import type { TokenizeResult } from '../tokenizer/tokenizer';
import {
    type AnyCommentRule,
    type EmptyRule,
    type NetworkRule,
    RuleCategory,
} from '../nodes';
import { createPreparserContext, initPreparserContext } from '../preparser/context';
import type { PreparserContext } from '../preparser/context';
import { RulePreparser, RuleKind } from '../preparser/rule';
import { CommentAstParser } from './comment/comment';
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
 * Cosmetic rules are not yet supported and will throw at parse time.
 */
// TODO: Use AnyRule from nodes.ts
export type AnyParsedRule = EmptyRule | AnyCommentRule | NetworkRule;

/**
 * High-level parser for adblock rules.
 *
 * Wraps the three-step pipeline (tokenize → preparse → build AST) and
 * reuses internal buffers for performance. Automatically determines whether
 * the input is a comment, network, or empty rule.
 *
 * Cosmetic rules are not yet supported — a descriptive `Error` is thrown if
 * one is encountered.
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
    private tokens: TokenizeResult;

    private ctx: PreparserContext;

    /**
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
     * @returns Parsed rule AST node.
     * @throws {Error} For cosmetic rules (not yet implemented).
     */
    parse(source: string, options?: PreparserParseOptions): AnyParsedRule {
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

        const kind = RulePreparser.preparse(this.ctx);

        switch (kind) {
            case RuleKind.Comment:
                return CommentAstParser.parse(source, this.ctx.data, options);

            case RuleKind.Network:
                return NetworkRuleAstParser.parse(source, this.ctx.data, options);

            default:
                throw new Error(`Unknown rule kind: ${kind}`);
        }
    }
}
