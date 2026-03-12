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
 * Default maximum number of tokens per comment rule.
 * Comment rules are typically short (metadata headers, hints, etc.).
 */
const DEFAULT_TOKEN_CAPACITY = 1024;

/**
 * Default maximum number of children (hints or agents) per comment rule.
 * Most comment rules have 0-5 children; 32 provides headroom for edge cases.
 */
const DEFAULT_CHILDREN_CAPACITY = 32;

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
     * @param tokenCapacity Maximum number of tokens per rule.
     * @param childrenCapacity Maximum number of hints or agents per rule.
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
