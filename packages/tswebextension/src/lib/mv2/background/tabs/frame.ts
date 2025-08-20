import { type PreparedCosmeticResultCommon, FrameCommon } from '../../../common/tabs/frame';

/**
 * Prepared cosmetic result for MV2.
 *
 * This type represents the processed cosmetic data extracted from the initial cosmetic result.
 */
type PreparedCosmeticResultMV2 = PreparedCosmeticResultCommon & {
    /**
     * Script text extracted from the cosmetic result.
     */
    scriptText: string;
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
}
