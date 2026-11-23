/**
 * ExtendedCss marker state reported to the content script.
 */
export enum ExtCssMarkersState {
    /**
     * The background did not report the marker state in this response.
     *
     * Both manifest versions apply ExtendedCss in the page from the
     * background, so the background is the only side that reports the state.
     * It carries this value in the initial `GetCosmeticData` response, before
     * it has an outcome to report; a reapply response carries the confirmed
     * state on both manifest versions.
     */
    ContentScript = 'contentScript',

    /**
     * Nothing was expected: the background has no marked ExtendedCss rules for
     * the document.
     */
    NotRequired = 'notRequired',

    /**
     * The background injected the marked ExtendedCss rules.
     */
    Applied = 'applied',

    /**
     * The background tried to inject the marked ExtendedCss rules and failed.
     */
    Failed = 'failed',
}
