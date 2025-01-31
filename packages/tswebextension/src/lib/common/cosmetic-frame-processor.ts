/**
 * Precalculate cosmetic props.
 *
 * For more details see CosmeticFrameProcessor.precalculateCosmetics().
 */
export type PrecalculateCosmeticProps = {
    /**
     * Frame url.
     */
    url: string,

    /**
     * Frame tab id.
     */
    tabId: number,

    /**
     * Frame id.
     */
    frameId: number,

    /**
     * Frame creation timestamp.
     */
    timeStamp: number,

    /**
     * Parent document id.
     */
    parentDocumentId?: string

    /**
     * Document id.
     */
    documentId?: string,
};

/**
 * Handle sub frame without url props.
 */
export type HandleSubFrameWithoutUrlProps = {
    /**
     * Tab id.
     */
    tabId: number,

    /**
     * Frame id.
     */
    frameId: number,

    /**
     * Main frame url.
     */
    mainFrameUrl?: string,

    /**
     * Parent document id.
     */
    parentDocumentId?: string,
};

/**
 * Handle sub frame with url props.
 */
export type HandleSubFrameWithUrlProps = {
    /**
     * Frame url.
     */
    url: string,

    /**
     * Tab id.
     */
    tabId: number,

    /**
     * Frame id.
     */
    frameId: number,

    /**
     * Main frame url.
     */
    mainFrameUrl?: string,

    /**
     * Main frame rule.
     */
    mainFrameRule: any,
};

/**
 * Handle main frame props.
 */
export type HandleMainFrameProps = {
    /**
     * Url.
     */
    url: string,

    /**
     * Tab id.
     */
    tabId: number,

    /**
     * Frame id.
     */
    frameId: number,

    /**
     * Document id.
     */
    documentId?: number,
};
