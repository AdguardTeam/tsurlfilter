/**
 * @file Comment AST parser — top-level dispatcher.
 *
 * Builds any comment-rule AST node from parsed data. The caller must have
 * already called `CommentParser.parse(ctx)` so that `ctx.data` is
 * populated with structural indices and `ctx.data[0]` holds the `CommentKind`.
 */

import type { AnyCommentRule } from '../../nodes';
import { CommentKind } from '../../parser/comment/types';
import type { ParseOptions } from '../options';

import { AgentCommentAstBuilder } from './agent';
import { HintCommentAstBuilder } from './hint';
import { MetadataCommentAstBuilder } from './metadata';
import { PreprocessorCommentAstBuilder } from './preprocessor';
import { SimpleCommentAstBuilder } from './simple';

/**
 * Top-level comment rule AST parser.
 *
 * Reads the `CommentKind` stored at `data[0]` by `CommentParser.parse`
 * and delegates to the matching individual parser.
 */
export class CommentAstBuilder {
    /**
     * Builds a comment-rule AST node from parsed buffer data.
     *
     * @param source Original source string.
     * @param data Buffer written by `CommentParser.parse`.
     * @param dataOffset Offset within `data` where the comment header starts.
     * @param options Parse options.
     *
     * @returns The appropriate comment-rule AST node.
     */
    public static parse(
        source: string,
        data: Int32Array,
        dataOffset = 0,
        options: ParseOptions = {},
    ): AnyCommentRule {
        const kind = data[dataOffset];

        switch (kind) {
            case CommentKind.Preprocessor:
                return PreprocessorCommentAstBuilder.parse(source, data, dataOffset, options);

            case CommentKind.Hint:
                return HintCommentAstBuilder.parse(source, data, dataOffset, options);

            case CommentKind.Metadata:
                return MetadataCommentAstBuilder.parse(source, data, dataOffset, options);

            case CommentKind.Agent:
                return AgentCommentAstBuilder.parse(source, data, dataOffset, options);

            case CommentKind.Simple:
            default:
                return SimpleCommentAstBuilder.parse(source, data, dataOffset, options);
        }
    }
}
