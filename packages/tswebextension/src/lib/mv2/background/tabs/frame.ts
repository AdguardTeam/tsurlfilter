import type { CosmeticResult, MatchingResult } from '@adguard/tsurlfilter';

import { createInjectionFsm } from './injectionFsm';

/**
 * Document level frame id.
 */
export const MAIN_FRAME_ID = 0;

/**
 * Frame context data.
 */
export class Frame {
    /**
     * Frame url.
     */
    public url: string;

    /**
     * FSM for managing the injection of the JS rules.
     */
    public jsInjectionFsm = createInjectionFsm();

    /**
     * FSM for managing the injection of the Css rules.
     */
    public cssInjectionFsm = createInjectionFsm();

    /**
     * Frame request id.
     */
    public requestId?: string;

    /**
     * Frame cosmetic result.
     * This data is saved in frame, because we need for access it
     * after request content data delete.
     */
    public cosmeticResult?: CosmeticResult;

    /**
     * Frame matching result.
     * This data is saved in frame, because we need for access it
     * after request content data delete.
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
