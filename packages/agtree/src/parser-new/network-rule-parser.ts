/**
 * @file High-level NetworkRuleParser — public API wrapping the full pipeline.
 *
 * Owns the tokenizer buffers and preparser context, reusing them across
 * calls for optimal performance.
 */

import { tokenizeLine } from '../tokenizer/tokenizer';
import type { TokenizeResult } from '../tokenizer/tokenizer';
import type { NetworkRule } from '../nodes';
import { createPreparserContext, initPreparserContext } from '../preparser/context';
import type { PreparserContext } from '../preparser/context';
import { NetworkRulePreparser } from '../preparser/network-rule';
import { NetworkRuleAstParser } from './network-rule';
import type { PreparserParseOptions } from './network-rule';

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
    private tokens: TokenizeResult;

    private ctx: PreparserContext;

    constructor(tokenCapacity = 1024, modifierCapacity = 64) {
        this.tokens = {
            tokenCount: 0,
            types: new Uint8Array(tokenCapacity),
            ends: new Uint32Array(tokenCapacity),
            actualEnd: 0,
            overflowed: 0,
        };
        this.ctx = createPreparserContext(tokenCapacity, modifierCapacity);
    }

    /**
     * Parse a network rule string into an AST.
     *
     * @param source Network rule source string.
     * @param options Parsing options (location, raws).
     * @returns Parsed NetworkRule AST node.
     */
    parse(source: string, options?: PreparserParseOptions): NetworkRule {
        tokenizeLine(source, 0, this.tokens);
        initPreparserContext(this.ctx, source, this.tokens);
        NetworkRulePreparser.preparse(this.ctx);
        return NetworkRuleAstParser.parse(source, this.ctx.data, options);
    }
}
