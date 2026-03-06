/**
 * @file Comment preparser — shared types and buffer layout constants.
 *
 * All comment preparsers write to `ctx.data`. Slot 0 is always the
 * `CommentKind` discriminator; subsequent slots are kind-specific.
 */

export const enum CommentKind {
    Simple = 0,
    Preprocessor = 1,
    Hint = 2,
    Metadata = 3,
    Config = 4,
    Agent = 5,
}

export const CM_KIND = 0;

// ── Simple ────────────────────────────────────────────────────────────────────
// data: [ KIND, MARKER_START, TEXT_START, TEXT_END ]

export const CM_SIMPLE_MARKER = 1;
export const CM_SIMPLE_TEXT_START = 2;
export const CM_SIMPLE_TEXT_END = 3;

// ── Preprocessor ──────────────────────────────────────────────────────────────
// data: [ KIND, NAME_START, NAME_END, PARAMS_START, PARAMS_END,
//         <union buffer starting at offset 5> ]
// PARAMS_START / PARAMS_END are -1 when the directive has no parameters.
// The union buffer at offset 5 is used exclusively by one of:
//   - LE node tree  (LE_BUFFER_SIZE=162 slots)  when directive is 'if'
//   - PL entry list (PL_BUFFER_SIZE=67  slots)  when directive is 'safari_cb_affinity'

export const CM_PREP_NAME_START = 1;
export const CM_PREP_NAME_END = 2;
export const CM_PREP_PARAMS_START = 3;
export const CM_PREP_PARAMS_END = 4;

/**
 * Offset within `ctx.data` where the embedded logical-expression buffer
 * begins for `!#if` directives (right after the 5 header fields).
 */
export const CM_PREP_LE_OFFSET = 5;

/**
 * Offset within `ctx.data` where the embedded parameter-list buffer
 * begins for `!#safari_cb_affinity` directives.
 *
 * Shares the same region as {@link CM_PREP_LE_OFFSET} — LE and PL are
 * mutually exclusive (different directive names).
 */
export const CM_PREP_PL_OFFSET = CM_PREP_LE_OFFSET;

// ── Hint ──────────────────────────────────────────────────────────────────────
// data: [ KIND, COUNT, <COUNT * CM_HINT_STRIDE slots> ]
// Per hint: NAME_START, NAME_END, PARAMS_START, PARAMS_END
// PARAMS_START / PARAMS_END are -1 when the hint has no parameters.

export const CM_HINT_COUNT = 1;
export const CM_HINT_HEADER = 2;
export const CM_HINT_STRIDE = 4;
export const CM_HINT_NAME_START = 0;
export const CM_HINT_NAME_END = 1;
export const CM_HINT_PARAMS_START = 2;
export const CM_HINT_PARAMS_END = 3;

// ── Metadata ──────────────────────────────────────────────────────────────────
// data: [ KIND, MARKER_START, HEADER_START, HEADER_END, VALUE_START, VALUE_END ]

export const CM_META_MARKER = 1;
export const CM_META_HEADER_START = 2;
export const CM_META_HEADER_END = 3;
export const CM_META_VALUE_START = 4;
export const CM_META_VALUE_END = 5;

// ── Config ────────────────────────────────────────────────────────────────────
// data: [ KIND, MARKER_START, CMD_START, CMD_END, PARAMS_START, PARAMS_END,
//         CMT_START, CMT_END ]
// PARAMS_START / PARAMS_END and CMT_START / CMT_END are -1 when absent.

export const CM_CFG_MARKER = 1;
export const CM_CFG_CMD_START = 2;
export const CM_CFG_CMD_END = 3;
export const CM_CFG_PARAMS_START = 4;
export const CM_CFG_PARAMS_END = 5;
export const CM_CFG_CMT_START = 6;
export const CM_CFG_CMT_END = 7;

// ── Agent ─────────────────────────────────────────────────────────────────────
// data: [ KIND, COUNT, <COUNT * CM_AGENT_STRIDE slots> ]
// Per agent: START, END (trimmed source offsets, exclusive end).

export const CM_AGENT_COUNT = 1;
export const CM_AGENT_HEADER = 2;
export const CM_AGENT_STRIDE = 2;
export const CM_AGENT_START = 0;
export const CM_AGENT_END = 1;
