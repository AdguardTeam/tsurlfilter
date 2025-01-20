import { type ScriptletData } from '@adguard/tsurlfilter';

import { type PreparedCosmeticResultCommon, FrameCommon } from '../../common/tabs/frame';

/**
 * Scriptlet rule data object which contains scriptlet data for execution
 * and scriptlet rule text (rule content) to match whether it is local or not.
 */
export type ScriptletRuleData = {
    /**
     * Scriptlet data for the execution.
     */
    scriptletRunData: ScriptletData,

    /**
     * Scriptlet rule text to match whether it is local or not.
     *
     * @example
     * `//scriptlet('set-constant', 'canRunAds', 'true')`
     */
    scriptletRuleText: string,
};

/**
 * Prepared cosmetic result for MV3.
 */
type PreparedCosmeticResultMV3 = PreparedCosmeticResultCommon & {
    /**
     * Script texts extracted from the cosmetic result.
     */
    scriptTexts: string[],

    /**
     * A list of scriptlet data extracted from the cosmetic result.
     */
    scriptletDataList: ScriptletRuleData[];
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
