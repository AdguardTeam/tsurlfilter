/**
 * Size ceiling shared by the MV3 `executeScript({ func })` payload and the
 * MV2 `executeScript({ code })` string.
 *
 * The value is the serialized payload only, not the total arguments payload
 * (see `extcss-large-ruleset.test.ts` for the total-payload ceiling). It
 * covers accidental growth of the inlined engine and leaves headroom for
 * representative rule sets.
 */
export const APPLY_FN_MAX_BYTES = 96 * 1024;
