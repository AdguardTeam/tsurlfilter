import {
    DeclarativeFilterConverter,
    Filter,
    ConversionResult,
    IFilter,
} from '@adguard/tsurlfilter';

export { ConversionResult };

export const USER_FILTER_ID = 0;

const {
    MAX_NUMBER_OF_REGEX_RULES,
    MAX_NUMBER_OF_DYNAMIC_AND_SESSION_RULES,
} = chrome.declarativeNetRequest;

/**
 * UserRulesApi knows how to handle dynamic rules: apply a list of custom
 * filters along with user rules and disable all dynamic rules
 * when the filtration is stopped.
 */
export default class UserRulesApi {
    /**
     * Converts custom filters and user rules on the fly into a single merged
     * rule set and applies it via the declarativeNetRequest API.
     *
     * @param userRules String[] contains user rules.
     * @param customFilters List of custom filters.
     * @param resourcesPath String path to web accessible resources,
     * relative to the extension root dir. Should start with leading slash '/'.
     *
     * @returns Converted dynamic rule set with rule set, errors and
     * limitations. @see {@link ConversionResult}.
     */
    public static async updateDynamicFiltering(
        userRules: string[],
        customFilters: IFilter[],
        resourcesPath?: string,
    ): Promise<ConversionResult> {
        const filterList = [
            new Filter(
                USER_FILTER_ID,
                { getContent: () => Promise.resolve(userRules) },
            ),
            ...customFilters,
        ];

        // Create filter and convert into single rule set
        const converter = new DeclarativeFilterConverter();
        const conversionResult = await converter.convertToSingle(
            filterList,
            {
                resourcesPath,
                maxNumberOfRules: MAX_NUMBER_OF_DYNAMIC_AND_SESSION_RULES,
                maxNumberOfRegexpRules: MAX_NUMBER_OF_REGEX_RULES,
            },
        );
        const { ruleSets: [ruleSet] } = conversionResult;

        const { declarativeRules } = await ruleSet.serialize();

        // Remove existing dynamic rules, in order their ids not interfere
        // with new
        await this.removeAllRules();
        await chrome.declarativeNetRequest.updateDynamicRules({
            // The need for explicit type conversion because the types from
            // "@types/chrome" are obsolete
            addRules: declarativeRules as chrome.declarativeNetRequest.Rule[],
        });

        return conversionResult;
    }

    /**
     * Disables all enabled dynamic rules.
     */
    public static async removeAllRules(): Promise<void> {
        // Get existing dynamic rules
        const existingRules = await chrome.declarativeNetRequest.getDynamicRules();
        const existingRulesIds = existingRules.map((rule) => rule.id);

        // Remove existing dynamic rules
        await chrome.declarativeNetRequest.updateDynamicRules({ removeRuleIds: existingRulesIds });
    }
}
