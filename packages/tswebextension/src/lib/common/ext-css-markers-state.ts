/**
 * ExtendedCss marker state reported to the content script.
 */
export enum ExtCssMarkersState {
    /**
     * The content script applies ExtendedCss itself, so the background cannot
     * know the marker state.
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
