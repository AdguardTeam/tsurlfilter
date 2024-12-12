import type { ScriptletData } from '@adguard/tsurlfilter';

import { type PreparedCosmeticResultCommon, FrameCommon } from '../../common/tabs/frame';

/**
 * Prepared cosmetic result for MV3.
 */
type PreparedCosmeticResultMV3 = PreparedCosmeticResultCommon & {
    /**
     * A list of scriptlet data extracted from the cosmetic result.
     */
    scriptletDataList: ScriptletData[];
};

/**
 * Frame context data for MV3.
 *
 * @see {@link FrameCommon} description.
 */
export class FrameMV3 extends FrameCommon {
    /**
     * Prepared cosmetic result for the frame in MV3.
     *
     * This data is saved in the frame because it is needed for injecting cosmetic rules into the frames.
     */
    public preparedCosmeticResult?: PreparedCosmeticResultMV3;
}
