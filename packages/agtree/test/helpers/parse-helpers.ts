/**
 * @file Test helpers that run the full tokenize → parse → AST build pipeline.
 *
 * These replace the deleted pipeline-wrapper classes that used to live in
 * `src/ast-builder/`. Production code should call the parser and AST builder
 * layers separately; these helpers exist only for test convenience.
 */

import { CommentAstBuilder } from '../../src/ast-builder/comment/comment';
import { SelectorListAstBuilder, type SelectorListParseOptions } from '../../src/ast-builder/cosmetic/selector-list';
import { NetworkRuleAstBuilder } from '../../src/ast-builder/network/network-rule';
import type { ParseOptions } from '../../src/ast-builder/options';
import type { AnyCommentRule, NetworkRule, SelectorList } from '../../src/nodes';
import { CommentParser } from '../../src/parser/comment/classifier';
import { createParserContext, initParserContext } from '../../src/parser/context';
import { SelectorListParser } from '../../src/parser/css/selector-list';
import { DEFAULT_MAX_COMPLEX } from '../../src/parser/css/selector-list/constants';
import { NetworkRuleParser } from '../../src/parser/network/network-rule';
import { Tokenizer } from '../../src/tokenizer/tokenizer';

const TOKEN_CAPACITY = 1024;

/**
 * Parse a comment rule string into an AST node.
 *
 * @param source Comment rule source string.
 * @param options Parsing options.
 *
 * @returns Parsed comment rule AST node.
 */
export function parseCommentRule(source: string, options?: ParseOptions): AnyCommentRule {
    const tokenizer = new Tokenizer(TOKEN_CAPACITY);
    tokenizer.setSource(source);

    const ctx = createParserContext(TOKEN_CAPACITY, 32);
    initParserContext(ctx, source, tokenizer);

    CommentParser.parse(ctx);
    return CommentAstBuilder.parse(source, ctx.data, 0, options);
}

/**
 * Parse a network rule string into an AST node.
 *
 * @param source Network rule source string.
 * @param options Parsing options.
 *
 * @returns Parsed NetworkRule AST node.
 */
export function parseNetworkRule(source: string, options?: ParseOptions): NetworkRule {
    const tokenizer = new Tokenizer(TOKEN_CAPACITY);
    tokenizer.setSource(source);

    const ctx = createParserContext(TOKEN_CAPACITY, 64);
    initParserContext(ctx, source, tokenizer);

    NetworkRuleParser.parse(ctx);
    return NetworkRuleAstBuilder.parse(source, ctx.data, 0, options);
}

/**
 * Parse a CSS selector list string into an AST node.
 *
 * @param raw Raw CSS selector list string.
 * @param options Parse options.
 * @param baseOffset Starting offset within the original source.
 *
 * @returns SelectorList AST node.
 */
export function parseSelectorList(
    raw: string,
    options: SelectorListParseOptions = {},
    baseOffset = 0,
): SelectorList {
    const { isLocIncluded = true } = options;

    const tokenizer = new Tokenizer(TOKEN_CAPACITY);
    tokenizer.setSource(raw, 0);

    const ctx = createParserContext(TOKEN_CAPACITY);
    initParserContext(ctx, raw, tokenizer, baseOffset);

    const dataOffset = 0;
    SelectorListParser.parse(ctx, 0, ctx.tokenCount, dataOffset, DEFAULT_MAX_COMPLEX);

    return SelectorListAstBuilder.parse(
        raw,
        ctx.data,
        dataOffset,
        DEFAULT_MAX_COMPLEX,
        baseOffset,
        baseOffset + raw.length,
        { isLocIncluded },
    );
}
