/**
 * @file High-level CommentRuleParser — public API wrapping the full pipeline.
 *
 * Owns the tokenizer buffers and preparser context, reusing them across
 * calls for optimal performance.
 */

import { tokenizeLine } from '../../tokenizer/tokenizer';
import type { TokenizeResult } from '../../tokenizer/tokenizer';
import type { AnyCommentRule } from '../../nodes';
import { createPreparserContext, initPreparserContext } from '../../preparser/context';
import type { PreparserContext } from '../../preparser/context';
import { CommentClassifier } from '../../preparser/comment/classifier';
import { CommentAstParser } from './comment';
import type { PreparserParseOptions } from '../network/network-rule';

/**
 * High-level parser for comment rules.
 *
 * Wraps the three-step pipeline (tokenize → preparse → build AST) and
 * reuses internal buffers for performance.
 *
 * @example
 * ```typescript
 * const parser = new CommentRuleParser();
 * const ast = parser.parse('! Title: My Filter List');
 * ```
 */
export class CommentRuleParser {
    private tokens: TokenizeResult;

    private ctx: PreparserContext;

    /**
     * @param tokenCapacity Maximum number of tokens per rule (default 1024).
     * @param childrenCapacity Maximum number of hints or agents per rule (default 32).
     */
    constructor(tokenCapacity = 1024, childrenCapacity = 32) {
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
     * Parse a comment rule string into an AST node.
     *
     * @param source Comment rule source string.
     * @param options Parsing options (location, raws).
     * @returns Parsed comment rule AST node.
     */
    parse(source: string, options?: PreparserParseOptions): AnyCommentRule {
        tokenizeLine(source, 0, this.tokens);
        initPreparserContext(this.ctx, source, this.tokens);
        CommentClassifier.preparse(this.ctx);
        return CommentAstParser.parse(source, this.ctx.data, options);
    }
}
