/**
 * @file High-level CommentRuleParser — public API wrapping the full pipeline.
 *
 * Owns the tokenizer buffers and preparser context, reusing them across
 * calls for optimal performance.
 */

import type { AnyCommentRule } from '../../nodes-new';
import { CommentClassifier } from '../../preparser/comment/classifier';
import { createPreparserContext, initPreparserContext } from '../../preparser/context';
import type { PreparserContext } from '../../preparser/context';
import { Tokenizer } from '../../tokenizer/tokenizer';
import type { PreparserParseOptions } from '../options';

import { CommentAstParser } from './comment';

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
    /**
     * Tokenizer instance.
     */
    private tokenizer: Tokenizer;

    /**
     * Preparser context.
     */
    private ctx: PreparserContext;

    /**
     * Creates a new comment rule parser.
     *
     * @param tokenCapacity Maximum number of tokens per rule.
     * @param childrenCapacity Maximum number of hints or agents per rule.
     */
    constructor(
        tokenCapacity = DEFAULT_TOKEN_CAPACITY,
        childrenCapacity = DEFAULT_CHILDREN_CAPACITY,
    ) {
        this.tokenizer = new Tokenizer(tokenCapacity);
        this.ctx = createPreparserContext(tokenCapacity, childrenCapacity);
    }

    /**
     * Parse a comment rule string into an AST node.
     *
     * @param source Comment rule source string.
     * @param options Parsing options (location, raws).
     *
     * @returns Parsed comment rule AST node.
     */
    public parse(source: string, options?: PreparserParseOptions): AnyCommentRule {
        this.tokenizer.setSource(source);
        initPreparserContext(this.ctx, source, this.tokenizer);
        CommentClassifier.preparse(this.ctx);
        return CommentAstParser.parse(source, this.ctx.data, options);
    }
}
