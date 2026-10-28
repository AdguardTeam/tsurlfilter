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
 * ExtendedCSS data resolved for a frame.
 */
export type ExtCssFrameData = {
    /**
     * ExtendedCSS rule strings to apply, or null when none match the frame.
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
     * ExtendedCSS data resolved from the on-demand cosmetic result.
     *
     * Frames precalculated by the cosmetic frame processor carry this data in
     * `preparedCosmeticResult` instead. It is kept here so repeated injection
     * events do not rebuild the rule strings.
     */
    public extCssData?: ExtCssFrameData;

    /**
     * Whether an ExtendedCSS instance with the frame's rules was applied to
     * the current document.
     *
     * The frame context is replaced on navigation, and `onCommitted` resets
     * the flag when the context survives, so it always describes the current
     * document.
     */
    public extCssApplied = false;
}
