/**
 * @file High-level NetworkRuleParser — public API wrapping the full pipeline.
 *
 * Owns the tokenizer buffers and preparser context, reusing them across
 * calls for optimal performance.
 */

import type { NetworkRule } from '../../nodes-new';
import type { PreparserContext } from '../../preparser/context';
import { createPreparserContext, initPreparserContext } from '../../preparser/context';
import { NetworkRulePreparser } from '../../preparser/network/network-rule';
import { Tokenizer } from '../../tokenizer/tokenizer';
import type { PreparserParseOptions } from '../options';

import { NetworkRuleAstParser } from './network-rule';

/**
 * Default maximum number of tokens per network rule.
 * Network rules can be complex with patterns, separators, and multiple modifiers.
 */
const DEFAULT_TOKEN_CAPACITY = 1024;

/**
 * Default maximum number of modifiers per network rule.
 * Most rules have 1-5 modifiers; 64 provides headroom for complex filter rules.
 */
const DEFAULT_MODIFIER_CAPACITY = 64;

/**
 * High-level parser for network rules.
 *
 * Wraps the three-step pipeline (tokenize → preparse → build AST) and
 * reuses internal buffers for performance.
 *
 * @example
 * ```typescript
 * const parser = new NetworkRuleParser();
 * const ast = parser.parse('||example.org^$script');
 * ```
 */
export class NetworkRuleParser {
    /**
     * Tokenizer instance.
     */
    private tokenizer: Tokenizer;

    /**
     * Preparser context.
     */
    private ctx: PreparserContext;

    /**
     * Creates a new network rule parser.
     *
     * @param tokenCapacity Maximum number of tokens per rule.
     * @param modifierCapacity Maximum number of modifiers per rule.
     */
    constructor(
        tokenCapacity = DEFAULT_TOKEN_CAPACITY,
        modifierCapacity = DEFAULT_MODIFIER_CAPACITY,
    ) {
        this.tokenizer = new Tokenizer(tokenCapacity);
        this.ctx = createPreparserContext(tokenCapacity, modifierCapacity);
    }

    /**
     * Parse a network rule string into an AST.
     *
     * @param source Network rule source string.
     * @param options Parsing options (location, raws).
     *
     * @returns Parsed NetworkRule AST node.
     */
    public parse(source: string, options?: PreparserParseOptions): NetworkRule {
        this.tokenizer.setSource(source);
        initPreparserContext(this.ctx, source, this.tokenizer);
        NetworkRulePreparser.preparse(this.ctx);
        return NetworkRuleAstParser.parse(source, this.ctx.data, options);
    }
}
