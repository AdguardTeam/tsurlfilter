import { type CosmeticResult, type MatchingResult, type NetworkRule } from '@adguard/tsurlfilter';

/**
 * Prepared cosmetic result.
 *
 * This type represents the processed cosmetic data extracted from the initial cosmetic result.
 */
export type PreparedCosmeticResultCommon = {
    /**
     * CSS styles extracted from the cosmetic result.
     */
    cssText?: string;
};

/**
 * Frame constructor properties.
 */
type FrameConstructorProps = {
    /**
     * Frame url.
     */
    url: string;

    /**
     * Tab id.
     */
    tabId: number;

    /**
     * Frame id.
     */
    frameId: number;

    /**
     * Frame creation time.
     */
    timeStamp: number;

    /**
     * Parent document id.
     */
    parentDocumentId?: string;

    /**
     * Document id.
     */
    documentId?: string;
};

/**
 * Frame context data.
 *
 * We store {@link MatchingResult} and {@link CosmeticResult} in the frame context
 * to apply rules that cannot be handled during request processing.
 * The frame data is deleted after the {@link browser.webNavigation.onCompleted} event.
 *
 * @see {@link WebRequestApi.deleteFrameContext}
 *
 * The class is abstract because FrameMV2 and FrameMV3 extend it.
 */
export abstract class FrameCommon {
    /**
     * Frame url.
     */
    public url: string;

    /**
     * Main frame url.
     */
    public mainFrameUrl?: string;

    /**
     * Tab id.
     */
    public tabId: number;

    /**
     * Frame id.
     */
    public frameId: number;

    /**
     * Frame creation time.
     */
    public timeStamp: number;

    /**
     * Frame rule. Needed in the case of allowlist rules for the tab.
     */
    public frameRule?: NetworkRule;

    /**
     * Parent document id.
     */
    public parentDocumentId?: string;

    /**
     * The cosmetic result for the frame.
     *
     * This data is stored in the frame because it is required for logging script and scriptlet rules.
     */
    public cosmeticResult?: CosmeticResult;

    /**
     * Matching result for the frame.
     *
     * This data is saved in frame, because we need for access it for script rules injection
     * after deleting request context data.
     */
    public matchingResult?: MatchingResult | null;

    /**
     * Unique identifier for the frame.
     */
    public documentId?: string;

    /**
     * Creates frame instance.
     *
     * @param props Frame constructor properties.
     */
    constructor(props: FrameConstructorProps) {
        const {
            url,
            tabId,
            frameId,
            timeStamp,
            parentDocumentId,
            documentId,
        } = props;

        this.url = url;
        this.tabId = tabId;
        this.frameId = frameId;
        this.timeStamp = timeStamp;
        this.parentDocumentId = parentDocumentId;
        this.documentId = documentId;
    }
}
