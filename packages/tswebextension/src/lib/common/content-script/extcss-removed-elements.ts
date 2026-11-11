/**
 * `window` key: the nodes the injected ExtendedCss function of MV2 or MV3
 * removed with a `:remove()` rule, so the content-script hits counter does not
 * restore them as probes. Internal: not re-exported from the `common` barrel.
 */
export const EXTCSS_REMOVED_ELEMENTS_KEY = '__adguardExtCssRemoved' as const;

declare global {
    interface Window {
        /**
         * Nodes removed by the injected ExtendedCss function of MV2 or MV3,
         * shared with the content script through the document's ISOLATED
         * world.
         */
        [EXTCSS_REMOVED_ELEMENTS_KEY]?: WeakSet<Element>;
    }
}
