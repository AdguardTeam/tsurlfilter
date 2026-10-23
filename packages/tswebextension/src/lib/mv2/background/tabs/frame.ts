import { FrameCommon, type PreparedCosmeticResultCommon } from '../../../common/tabs/frame';

/**
 * Prepared cosmetic result for MV2.
 *
 * This type represents the processed cosmetic data extracted from the initial cosmetic result.
 */
export type PreparedCosmeticResultMV2 = PreparedCosmeticResultCommon & {
    /**
     * Script text extracted from the cosmetic result.
     */
    scriptText: string;

    /**
     * ExtendedCSS rule strings to inject from the background, or null when no
     * extended rules match the frame.
     */
    extCssRules: string[] | null;

    /**
     * Whether ExtendedCSS hits statistics are collected for the frame.
     */
    areHitsStatsCollected: boolean;
};

/**
 * Frame context data for MV2.
 *
 * @see {@link FrameCommon} description.
 */
export class FrameMV2 extends FrameCommon {
    /**
     * Prepared cosmetic result for the frame in MV2.
     *
     * This data is saved in the frame because it is needed for injecting cosmetic rules into the frames.
     */
    public preparedCosmeticResult?: PreparedCosmeticResultMV2;

    /**
     * Whether an ExtendedCSS instance was injected into the current document.
     *
     * The frame context is replaced on navigation, so the flag normally
     * resets. When recalculation is skipped and the context survives, a stale
     * true value causes at most one no-op dispose call on the next empty rule
     * set.
     */
    public extCssApplied = false;
}
