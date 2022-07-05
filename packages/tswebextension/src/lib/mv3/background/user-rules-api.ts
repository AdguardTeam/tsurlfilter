import {
    DeclarativeConverter,
    StringRuleList,
    DeclarativeRule,
    ConvertedRuleId,
    HashOriginalRule,
} from '@adguard/tsurlfilter';

import { Configuration } from '../../common';

export const USER_FILTER_ID = 0;
export type { ConvertedRuleId, HashOriginalRule };
export type FilterConvertedSourceMap = Map<ConvertedRuleId, HashOriginalRule>;

type Filters = Configuration['filters'];

export default class UserRulesApi {
    /**
     * Stores a map of converted declarative rule identifiers relative
     * to the original rule line number in the filter OR
     * to the original rule line number in the filter with the filter identifier
     */
    private static privateConvertedSourceMap: FilterConvertedSourceMap = new Map();

    /**
     * Updates dynamic rules via declarativeNetRequest
     * @param userrules string[] contains custom user rules
     * @param resourcesPath string path to web accessible resources,
     * relative to the extension root dir. Should start with leading slash '/'
     * @returns the map of converted declarative rule identifiers with a hash to the original rule
     */
    public static async updateDynamicFiltering(
        userrules: string[],
        customFilters: Filters,
        resourcesPath?: string,
    ): Promise<FilterConvertedSourceMap> {
        const converter = new DeclarativeConverter();
        const lists = customFilters
            .map((f) => new StringRuleList(f.filterId, f.content))
            // Combining custom rules into one string with '\r\n' to be able
            // to cut the original rule in the debug panel
            .concat(new StringRuleList(USER_FILTER_ID, userrules.join('\r\n')));

        let convertedDynamicRules: DeclarativeRule[] = [];
        const convertedDynamicRulesSourceMap: FilterConvertedSourceMap = new Map();

        lists.forEach((list, idx) => {
            const { declarativeRules, convertedSourceMap } = converter.convert(list, {
                resourcesPath,
                // Sets an offset to prevent duplicate rule identifiers
                offsetId: idx * chrome.declarativeNetRequest.MAX_NUMBER_OF_DYNAMIC_AND_SESSION_RULES,
                // Since we are mixing all the dynamic rules into one list,
                // we need to save the original filter identifier in sourcemaps
                // to then find the original rule
                saveFilterId: true,
            });

            Array.from(convertedSourceMap)
                .forEach((item) => {
                    convertedDynamicRulesSourceMap.set(item[0], item[1]);
                });

            convertedDynamicRules = convertedDynamicRules.concat(declarativeRules);
        });

        // remove existing dynamic rules, in order their ids not interfere with new
        await this.removeAllRules();
        await chrome.declarativeNetRequest.updateDynamicRules({ addRules: convertedDynamicRules });

        UserRulesApi.privateConvertedSourceMap = convertedDynamicRulesSourceMap;

        return convertedDynamicRulesSourceMap;
    }

    /**
     * Disables all enabled dynamic rules
     */
    public static async removeAllRules(): Promise<void> {
        // get existing dynamic rules
        const existingRules = await chrome.declarativeNetRequest.getDynamicRules();
        const existingRulesIds = existingRules.map((rule) => rule.id);

        // remove existing dynamic rules
        await chrome.declarativeNetRequest.updateDynamicRules({ removeRuleIds: existingRulesIds });
    }

    /**
     * Returns the map of converted declarative rule
     * identifiers with a hash to the original rule
     */
    public static get convertedSourceMap() {
        return this.privateConvertedSourceMap;
    }
}
