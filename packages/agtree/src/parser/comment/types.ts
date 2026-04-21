/**
 * @file Shared comment parser types.
 *
 * All comment parsers write to `ctx.data`. Slot 0 is always the
 * `CommentKind` discriminator. Subsequent slots are kind-specific and
 * defined in each parser's file.
 */

/**
 * Comment sub-type discriminator.
 * Stored in `ctx.data[CM_KIND]` by all comment parsers.
 */
export const enum CommentKind {
    Simple = 0,
    Preprocessor = 1,
    Hint = 2,
    Metadata = 3,
    Config = 4,
    Agent = 5,
}

/**
 * Slot 0 in `ctx.data`: CommentKind discriminator (used by all comment parsers).
 */
export const CM_KIND = 0;
