/**
 * `window` key: the nodes the MV3 injected ExtendedCSS function removed with a
 * `:remove()` rule, so the content-script hits counter does not restore them
 * as probes. Internal: not re-exported from the `common` barrel.
 */
export const EXTCSS_REMOVED_ELEMENTS_KEY = '__adguardExtCssRemoved' as const;
