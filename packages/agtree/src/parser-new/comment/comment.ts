/**
 * @file Comment AST parser — top-level dispatcher.
 *
 * Builds any comment-rule AST node from preparsed data. The caller must have
 * already called `CommentClassifier.preparse(ctx)` so that `ctx.data` is
 * populated with structural indices and `ctx.data[0]` holds the `CommentKind`.
 */

import type { AnyCommentRule } from '../../nodes';
import { CommentKind } from '../../preparser/comment/types';
import type { PreparserParseOptions } from '../network/network-rule';

import { AgentCommentAstParser } from './agent';
import { HintCommentAstParser } from './hint';
import { MetadataCommentAstParser } from './metadata';
import { PreprocessorCommentAstParser } from './preprocessor';
import { SimpleCommentAstParser } from './simple';

/**
 * Top-level comment rule AST parser.
 *
 * Reads the `CommentKind` stored at `data[0]` by `CommentClassifier.preparse`
 * and delegates to the matching individual parser.
 */
export class CommentAstParser {
    /**
     * Builds a comment-rule AST node from preparsed buffer data.
     *
     * @param source Original source string.
     * @param data Buffer written by `CommentClassifier.preparse`.
     * @param options Parse options.
     *
     * @returns The appropriate comment-rule AST node.
     */
    public static parse(source: string, data: Int32Array, options: PreparserParseOptions = {}): AnyCommentRule {
        const kind = data[0];

        switch (kind) {
            case CommentKind.Preprocessor:
                return PreprocessorCommentAstParser.parse(source, data, options);

            case CommentKind.Hint:
                return HintCommentAstParser.parse(source, data, options);

            case CommentKind.Metadata:
                return MetadataCommentAstParser.parse(source, data, options);

            case CommentKind.Agent:
                return AgentCommentAstParser.parse(source, data, options);

            case CommentKind.Simple:
            default:
                return SimpleCommentAstParser.parse(source, data, options);
        }
    }
}
