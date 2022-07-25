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

type ConvertedResult = {
    regexpRulesCounter: number,
    convertedDynamicRules: DeclarativeRule[],
    convertedDynamicRulesSourceMap: FilterConvertedSourceMap,
};

export type UpdateDynamicRulesResult = {
    regexpRulesCounter: number,
    declarativeRulesCounter: number,
    errors: UserRulesErrors[],
};

export const enum UserRulesErrors {
    TOO_MANY_DECLARATIVE_RULES,
    TOO_MANY_REGEXP_RULES,
}

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
    ): Promise<UpdateDynamicRulesResult> {
        const lists = customFilters
            .map((f) => new StringRuleList(f.filterId, f.content))
            // Combining custom rules into one string with '\n' to be able
            // to cut the original rule in the debug panel
            .concat(new StringRuleList(USER_FILTER_ID, userrules.join('\n')));

        const {
            regexpRulesCounter,
            convertedDynamicRules,
            convertedDynamicRulesSourceMap,
        } = await this.convertLists(lists, resourcesPath);

        // Save converted result
        UserRulesApi.privateConvertedSourceMap = convertedDynamicRulesSourceMap;

        // Prepare result
        const res: UpdateDynamicRulesResult = {
            regexpRulesCounter,
            declarativeRulesCounter: convertedDynamicRules.length,
            errors: [] as UserRulesErrors[],
        };

        // Check for regexp rules limitation
        if (res.regexpRulesCounter > chrome.declarativeNetRequest.MAX_NUMBER_OF_REGEX_RULES) {
            // Stop execute func, because we cannot identify which rules
            // include regexps and cut only them
            res.errors.push(UserRulesErrors.TOO_MANY_REGEXP_RULES);
            return res;
        }

        let addRules = convertedDynamicRules;
        // Check for declarative rules limitation
        if (convertedDynamicRules.length > chrome.declarativeNetRequest.MAX_NUMBER_OF_DYNAMIC_AND_SESSION_RULES) {
            res.errors.push(UserRulesErrors.TOO_MANY_DECLARATIVE_RULES);

            // Cut dynamic rules to maximum possible count
            addRules = addRules.slice(0, chrome.declarativeNetRequest.MAX_NUMBER_OF_DYNAMIC_AND_SESSION_RULES);
        }

        // remove existing dynamic rules, in order their ids not interfere with new
        await this.removeAllRules();
        await chrome.declarativeNetRequest.updateDynamicRules({ addRules });

        return res;
    }

    /**
     * Convert array of StringRuleList to one array of declarative rules
     * @param lists array of StringRuleList
     * @param resourcesPath string path to web accessible resources
     * @returns array of declarative rules with sourcemap and counter for array
     */
    private static async convertLists(
        lists: StringRuleList[],
        resourcesPath?: string,
    ): Promise<ConvertedResult> {
        let convertedDynamicRules: DeclarativeRule[] = [];
        let regexpRulesCounter = 0;
        const convertedDynamicRulesSourceMap: FilterConvertedSourceMap = new Map();

        const converter = new DeclarativeConverter();
        lists.forEach((list, idx) => {
            const converted = converter.convert(list, {
                resourcesPath,
                // Sets an offset to prevent duplicate rule identifiers
                offsetId: idx * chrome.declarativeNetRequest.MAX_NUMBER_OF_DYNAMIC_AND_SESSION_RULES,
                // Since we are mixing all the dynamic rules into one list,
                // we need to save the original filter identifier in sourcemaps
                // to then find the original rule
                saveFilterId: true,
            });

            Array.from(converted.convertedSourceMap)
                .forEach((item) => {
                    convertedDynamicRulesSourceMap.set(item[0], item[1]);
                });

            convertedDynamicRules = convertedDynamicRules.concat(converted.declarativeRules);
            regexpRulesCounter += converted.regexpRulesCounter;
        });

        return {
            regexpRulesCounter,
            convertedDynamicRules,
            convertedDynamicRulesSourceMap,
        };
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
    public static get convertedSourceMap(): FilterConvertedSourceMap {
        return this.privateConvertedSourceMap;
    }
}
