/**
 * `window` key under which the MV3 injected ExtendedCSS function records the
 * elements it removed with a `:remove()` rule.
 *
 * The injected function runs in the document's ISOLATED world — the same world
 * as the content script — so the content-script `CssHitsCounter` reads the set
 * from the same `window` object and does not put those elements back into the
 * page as probes.
 *
 * Internal injection detail: this module is not re-exported from the `common`
 * barrel, so the published package does not expose it.
 */
export const EXTCSS_REMOVED_ELEMENTS_KEY = '__adguardExtCssRemoved' as const;
