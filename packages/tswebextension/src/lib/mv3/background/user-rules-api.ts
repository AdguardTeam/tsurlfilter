import {
    DeclarativeFilterConverter,
    Filter,
    ConversionResult,
    IFilter,
    IRuleSet,
    UpdateStaticRulesOptions,
} from '@adguard/tsurlfilter/es/declarative-converter';
import { logger } from '../utils/logger';
import { getErrorMessage } from '../../common/error';

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
     * @param staticRuleSets List of static rule sets to apply $badfilter rules
     * from dynamic rules to static.
     * @param resourcesPath String path to web accessible resources,
     * relative to the extension root dir. Should start with leading slash '/'.
     *
     * @returns Converted dynamic rule set with rule set, errors and
     * limitations. @see {@link ConversionResult}.
     */
    public static async updateDynamicFiltering(
        userRules: string[],
        customFilters: IFilter[],
        staticRuleSets: IRuleSet[],
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
        const conversionResult = await converter.convertDynamicRuleSets(
            filterList,
            staticRuleSets,
            {
                resourcesPath,
                maxNumberOfRules: MAX_NUMBER_OF_DYNAMIC_AND_SESSION_RULES,
                maxNumberOfRegexpRules: MAX_NUMBER_OF_REGEX_RULES,
            },
        );
        const { ruleSet, declarativeRulesToCancel } = conversionResult;

        const declarativeRules = await ruleSet.getDeclarativeRules();

        // Remove existing dynamic rules, in order their ids not interfere
        // with new
        await this.removeAllRules();
        await chrome.declarativeNetRequest.updateDynamicRules({
            // The need for explicit type conversion because the types from
            // "@types/chrome" are obsolete
            addRules: declarativeRules as chrome.declarativeNetRequest.Rule[],
        });

        if (declarativeRulesToCancel && declarativeRulesToCancel.length > 0) {
            // Apply $badfilter rules from dynamic filters.
            await this.applyBadFilterRules(declarativeRulesToCancel);
        } else {
            // Undoes all previously applied changes.
            await this.cancelAllStaticRulesUpdates(staticRuleSets);
        }

        return conversionResult;
    }

    /**
     * Cancels any disabled rules ids for all static rulesets.
     *
     * @param staticRuleSets List of static {@link IRuleSet}.
     */
    private static async cancelAllStaticRulesUpdates(
        staticRuleSets: IRuleSet[],
    ): Promise<void> {
        const tasks = staticRuleSets.map(async (r) => {
            const rulesetId = r.getId();

            // Get list of current disabled rules ids.
            const enableRuleIds = await chrome.declarativeNetRequest.getDisabledRuleIds({ rulesetId });

            // And enable all of them.
            return chrome.declarativeNetRequest.updateStaticRules({
                rulesetId,
                enableRuleIds,
            });
        });

        try {
            await Promise.all(tasks);
        } catch (e) {
            logger.error(`Cannot cancel all updates to static rules due to: ${getErrorMessage(e)}`);
        }
    }

    /**
     * Applies rules with $badfilter modifier which can cancel other rules from
     * static filters which already converted to declarative rules.
     *
     * @param declarativeRulesToCancel List of {@link UpdateStaticRulesOptions}.
     */
    private static async applyBadFilterRules(
        declarativeRulesToCancel: UpdateStaticRulesOptions[],
    ): Promise<void> {
        const tasks = declarativeRulesToCancel.map(async ({
            rulesetId,
            disableRuleIds: ruleIdsToDisable,
        }) => {
            // Get list of current disabled rules ids.
            const disabledRuleIds = await chrome.declarativeNetRequest.getDisabledRuleIds({ rulesetId });

            // Collect rules which should be enabled.
            const enableRuleIds = disabledRuleIds.filter((id) => !ruleIdsToDisable.includes(id));

            // Filter only that rules which are not disabled already.
            const disableRuleIds = ruleIdsToDisable.filter((id) => !disabledRuleIds.includes(id));

            return chrome.declarativeNetRequest.updateStaticRules({
                rulesetId,
                enableRuleIds,
                disableRuleIds,
            });
        });

        try {
            await Promise.all(tasks);
        } catch (e) {
            logger.error(`Cannot apply updates to static rules due to: ${getErrorMessage(e)}`);
        }
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
