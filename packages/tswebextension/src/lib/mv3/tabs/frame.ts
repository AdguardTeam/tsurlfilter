import { type ScriptletData } from '@adguard/tsurlfilter';

import { type PreparedCosmeticResultCommon, FrameCommon } from '../../common/tabs/frame';

/**
 * Prepared cosmetic result.
 * This type represents the processed cosmetic data extracted from the initial cosmetic result.
 */
type GeneralPreparedCosmeticResultMV3 = PreparedCosmeticResultCommon & {
    /**
     * CSS styles extracted from the cosmetic result.
     */
    cssText?: string;
};

/**
 * Prepared cosmetic result for MV3 with scriptlets data and script texts.
 */
type PreparedCosmeticResultMV3 = GeneralPreparedCosmeticResultMV3 & {
    /**
     * Script texts extracted from the cosmetic result.
     */
    scriptTexts: string[];

    /**
     * A list of scriptlet data extracted from the cosmetic result.
     */
    scriptletDataList: ScriptletData[];

    /**
     * Using never here ensures this type cannot have a scriptText property.
     */
    scriptText?: never;
};

/**
 * Prepared cosmetic result for MV3 for user scripts API with already combined
 * script text.
 */
type PreparedCosmeticResultMV3ForUserScripts = GeneralPreparedCosmeticResultMV3 & {
    /**
     * Script text extracted from the cosmetic result.
     */
    scriptText: string;

    /**
     * Using never here ensures this type cannot have scriptTexts and scriptletDataList properties.
     */
    scriptTexts?: never;

    /**
     * Using never here ensures this type cannot have scriptTexts and scriptletDataList properties.
     */
    scriptletDataList?: never;
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
    public preparedCosmeticResult?: PreparedCosmeticResultMV3 | PreparedCosmeticResultMV3ForUserScripts;
}
