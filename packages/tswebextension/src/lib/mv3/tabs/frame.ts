import { type CosmeticRule, type ScriptletData } from '@adguard/tsurlfilter';

import { FrameCommon, type PreparedCosmeticResultCommon } from '../../common/tabs/frame';

/**
 * Prepared cosmetic result for MV3.
 *
 * This type represents the processed cosmetic data extracted from the initial
 * cosmetic result.
 */
export type PreparedCosmeticResultMV3 = PreparedCosmeticResultCommon & {
    /**
     * Prepared cosmetic result for MV3 with scriptlets data and script texts.
     */
    localRules: {
        /**
         * Script texts extracted from rules to decrease injection time.
         */
        scriptTexts: string[];

        /**
         * A list of scriptlet data extracted from rules to decrease injection time.
         */
        scriptletDataList: ScriptletData[];

        /**
         * A list of raw script rules for log in filtering log.
         */
        rawRules: CosmeticRule[];
    };

    /**
     * Prepared cosmetic result for MV3 for user scripts API with already
     * combined scripts and scriptlets text into one script to decrease injection
     * time.
     */
    remoteRules: {
        /**
         * Combined scripts and scriptlets text into one script.
         */
        scriptText: string;

        /**
         * A list of raw script rules for log in filtering log.
         */
        rawRules: CosmeticRule[];
    };
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
     * This data is saved in the frame because it is needed for injecting
     * cosmetic rules into the frames.
     *
     * Optional, since this data will be computed after the frame is created
     * and may not be available immediately, but it should be available.
     */
    public preparedCosmeticResult?: PreparedCosmeticResultMV3;
}
