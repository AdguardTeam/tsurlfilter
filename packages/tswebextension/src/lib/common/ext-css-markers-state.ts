/**
 * ExtendedCss marker state reported to the content script.
 */
export enum ExtCssMarkersState {
    /**
     * The background did not report the marker state.
     *
     * No manifest applies ExtendedCss in the page: the background injects it
     * on both MV2 and MV3. On MV3 the background reports the state; on MV2 the
     * content script gets this value, which means "marker state not reported by
     * the background".
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
