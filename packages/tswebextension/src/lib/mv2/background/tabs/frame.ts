import { type CosmeticResult, type MatchingResult } from '@adguard/tsurlfilter';

/**
 * Frame context data.
 * We store {@link MatchingResult} and {@link CosmeticResult} in the frame context
 * to apply rules that cannot be handled during request processing.
 * The frame data is deleted after the {@link browser.webNavigation.onCompleted} event.
 * @see {@link WebRequestApi.deleteFrameContext}
 */
export class Frame {
    /**
     * Frame url.
     */
    public url: string;

    /**
     * Frame request id.
     */
    public requestId?: string;

    /**
     * Frame cosmetic result.
     * This data is saved in the frame because we need to access it for css injection
     * after deleting request context data.
     *
     * @see {@link WebRequestApi.injectCosmetic}
     */
    public cosmeticResult?: CosmeticResult;

    /**
     * Frame matching result.
     * This data is saved in frame, because we need for access it for script rules injection
     * after deleting request context data.
     */
    public matchingResult?: MatchingResult | null;

    /**
     * Creates frame instance.
     *
     * @param url Frame url.
     * @param requestId Request id.
     */
    constructor(url: string, requestId?: string) {
        this.url = url;
        this.requestId = requestId;
    }
}
