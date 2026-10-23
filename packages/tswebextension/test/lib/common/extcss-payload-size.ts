/**
 * Size ceiling shared by the MV3 `executeScript({ func })` payload and the
 * MV2 `executeScript({ code })` string.
 *
 * The value is the serialized payload only, not the total arguments payload
 * (see `extcss-large-ruleset.test.ts` for the total-payload ceiling). It
 * covers accidental growth of the inlined engine and leaves headroom for
 * representative rule sets.
 *
 * Measured value on 2026-10-20: 46 474 B (~45.4 KiB) for the Vitest-serialized
 * `extCssInjectedApply`. The ceiling leaves ~2x headroom for engine growth.
 */
export const APPLY_FN_MAX_BYTES = 96 * 1024;
