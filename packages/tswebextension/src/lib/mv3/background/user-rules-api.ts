import {
    DeclarativeFilterConverter,
    Filter,
    type ConversionResult,
    type IFilter,
    type IRuleSet,
    type UpdateStaticRulesOptions,
} from '@adguard/tsurlfilter/es/declarative-converter';
import browser from 'webextension-polyfill';

import { logger } from '../../common/utils/logger';
import { getErrorMessage } from '../../common/error';

export type { ConversionResult };

export const USER_FILTER_ID = 0;

/**
 * UserRulesApi knows how to handle dynamic rules: apply a list of custom
 * filters along with user rules and disable all dynamic rules
 * when the filtration is stopped.
 */
export default class UserRulesApi {
    /**
     * The maximum number of regular expression rules that an extension can add.
     * This limit is evaluated separately for the set of session rules,
     * dynamic rules and those specified in the rule_resources file.
     *
     * @returns Maximum number of regular expression rules.
     */
    private static get MAX_NUMBER_OF_REGEX_RULES(): number {
        return browser.declarativeNetRequest.MAX_NUMBER_OF_REGEX_RULES;
    }

    /**
     * The maximum number of combined dynamic and session scoped rules an extension can add.
     * In Chrome, this limit is enforced for the combination of dynamic and session scoped rules.
     * In Firefox, each ruleset has its own quota.
     *
     * @returns Maximum number of combined dynamic and session rules.
     */
    private static get MAX_NUMBER_OF_DYNAMIC_AND_SESSION_RULES(): number {
        return browser.declarativeNetRequest.MAX_NUMBER_OF_DYNAMIC_AND_SESSION_RULES;
    }

    /**
     * Converts custom filters and user rules on the fly into a single merged
     * rule set and applies it via the declarativeNetRequest API.
     *
     * @param userRules String[] contains user rules.
     * @param allowlistRule String with combined allowlist rules in AG format
     * (e.g. '@@$document,domain=example.com|example.org').
     * @param customFilters List of custom filters.
     * @param staticRuleSets List of static rule sets to apply $badfilter rules
     * from dynamic rules to static.
     * @param resourcesPath String path to web accessible resources,
     * relative to the extension root dir. Should start with leading slash '/'.
     *
     * @returns Converted dynamic rule set with rule set, errors and
     * limitations. @see {@link ConversionResult}.
     *
     * @throws Error if declarativeNetRequest.updateDynamicRules() receives invalid rules
     * e.g. with non-ASCII `urlFilter` value.
     * @see {@link https://developer.chrome.com/docs/extensions/reference/api/declarativeNetRequest#property-RuleCondition-urlFilter}
     */
    public static async updateDynamicFiltering(
        userRules: string[],
        allowlistRule: string,
        customFilters: IFilter[],
        staticRuleSets: IRuleSet[],
        resourcesPath?: string,
    ): Promise<ConversionResult> {
        const filterList = [
            // FIXME: (David, v3.0): Change declarative converter to AST-based
            new Filter(
                // NOTE: Here we use USER_FILTER_ID for user rules and allowlist rules.
                // But for tsurlfilter engine we use different filter id for
                // allowlist rules - ALLOWLIST_FILTER_ID.
                // TODO: This need to be changed in the future.
                USER_FILTER_ID,
                { getContent: () => Promise.resolve([allowlistRule].concat(userRules)) },
                // user filter considered as trusted
                true,
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
                maxNumberOfRules: UserRulesApi.MAX_NUMBER_OF_DYNAMIC_AND_SESSION_RULES,
                maxNumberOfRegexpRules: UserRulesApi.MAX_NUMBER_OF_REGEX_RULES,
            },
        );
        const { ruleSet, declarativeRulesToCancel } = conversionResult;

        const declarativeRules = await ruleSet.getDeclarativeRules();

        // Remove existing dynamic rules, in order their ids not interfere with new ones
        await this.removeAllRules();

        await browser.declarativeNetRequest.updateDynamicRules({
            // TODO update rule types returned by getDeclarativeRules();
            addRules: declarativeRules as browser.DeclarativeNetRequest.Rule[],
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
            // FIXME figure out how to implement since it is not available in webextension polyfill
            // @ts-ignore
            const enableRuleIds: number[] = await browser.declarativeNetRequest.getDisabledRuleIds({ rulesetId });

            // And enable all of them.
            // FIXME later
            // @ts-ignore
            return browser.declarativeNetRequest.updateStaticRules({
                rulesetId,
                enableRuleIds,
            });
        });

        try {
            await Promise.all(tasks);
        } catch (e) {
            // eslint-disable-next-line max-len
            logger.error(`[tswebextension.cancelAllStaticRulesUpdates]: cannot cancel all updates to static rules due to: ${getErrorMessage(e)}`);
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
            // FIXME later
            // @ts-ignore
            const disabledRuleIds: number[] = await browser.declarativeNetRequest.getDisabledRuleIds({ rulesetId });

            // Collect rules which should be enabled.
            const enableRuleIds = disabledRuleIds.filter((id) => !ruleIdsToDisable.includes(id));

            // Filter only that rules which are not disabled already.
            const disableRuleIds = ruleIdsToDisable.filter((id) => !disabledRuleIds.includes(id));

            // FIXME later
            // @ts-ignore
            return browser.declarativeNetRequest.updateStaticRules({
                rulesetId,
                enableRuleIds,
                disableRuleIds,
            });
        });

        try {
            await Promise.all(tasks);
        } catch (e) {
            // eslint-disable-next-line max-len
            logger.error(`[tswebextension.applyBadFilterRules]: cannot apply updates to static rules due to: ${getErrorMessage(e)}`);
        }
    }

    /**
     * Disables all enabled dynamic rules.
     */
    public static async removeAllRules(): Promise<void> {
        // Get existing dynamic rules
        const existingRules = await browser.declarativeNetRequest.getDynamicRules();
        const existingRulesIds = existingRules.map((rule) => rule.id);

        // Remove existing dynamic rules
        await browser.declarativeNetRequest.updateDynamicRules({ removeRuleIds: existingRulesIds });
    }
}
