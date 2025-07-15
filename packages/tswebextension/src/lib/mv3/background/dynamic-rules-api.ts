import {
    DeclarativeFilterConverter,
    type IFilter,
    type ConversionResult,
    type IRuleSet,
    type UpdateStaticRulesOptions,
} from '@adguard/tsurlfilter/es/declarative-converter';
import browser from 'webextension-polyfill';

import { logger } from '../../common/utils/logger';

export type { ConversionResult };

/**
 * DynamicRulesApi knows how to handle dynamic rules: apply a list of custom
 * filters along with user rules, allowlist and quick fixes rules and disable
 * all dynamic rules when the filtration is stopped.
 */
export default class DynamicRulesApi {
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
     * The maximum number of dynamic rules (safe and unsafe) an extension can add.
     *
     * In Chrome before v120, this limit is enforced for the combination of dynamic and session scoped rules.
     * In Firefox and Chrome (staring v121), each ruleset has its own quota.
     *
     * TODO: Maybe now we can move Quick Fixes rules to session ruleset.
     *
     * @returns Maximum number of dynamic rules.
     */
    private static get MAX_NUMBER_OF_DYNAMIC_RULES(): number {
        return browser.declarativeNetRequest.MAX_NUMBER_OF_DYNAMIC_RULES;
    }

    /**
     * The maximum number of **unsafe** dynamic rules an extension can add.
     *
     * @see {@link https://developer.chrome.com/docs/extensions/reference/api/declarativeNetRequest#property-MAX_NUMBER_OF_UNSAFE_DYNAMIC_RULES}
     *
     * @returns Maximum number of dynamic **unsafe** rules.
     */
    private static get MAX_NUMBER_OF_UNSAFE_DYNAMIC_RULES(): number {
        // Replace chrome.declarativeNetRequest.MAX_NUMBER_OF_UNSAFE_SESSION_RULES
        // with webextension-polyfill later, when the value becomes available.
        return chrome.declarativeNetRequest.MAX_NUMBER_OF_UNSAFE_DYNAMIC_RULES;
    }

    /**
     * Converts custom filters and user rules on the fly into a single merged
     * rule set and applies it via the declarativeNetRequest API.
     *
     * Filters will combine into one in following order:
     * - quickFixesFilter - they are most important and should be applied first,
     * - allowlistRules,
     * - blockingPageTrustedFilter - created on the blocking page by user,
     * - userRules,
     * - customFilters.
     *
     * @param quickFixesFilter Filter with hotfix rules.
     * @param allowlistRules Filter with allowlist rules.
     * @param blockingPageTrustedFilter Filter with blocking page trusted domains rules (badfiltered rules).
     * @param userRules Filter with user rules.
     * @param customFilters List of custom filters.
     * @param enabledStaticRuleSets List of enabled static rule sets to apply
     * $badfilter rules from dynamic rules to static.
     * @param resourcesPath String path to web accessible resources,
     * relative to the extension root dir. Should start with leading slash '/'.
     *
     * @returns Converted dynamic rule set with rule set, errors and
     * limitations. @see {@link ConversionResult}.
     *
     * @throws Error if declarativeNetRequest.updateDynamicRules() receives invalid rules
     * e.g. with non-ASCII `urlFilter` value.
     * Details: {@link https://developer.chrome.com/docs/extensions/reference/api/declarativeNetRequest#property-RuleCondition-urlFilter}.
     */
    public static async updateDynamicFiltering(
        quickFixesFilter: IFilter,
        allowlistRules: IFilter,
        blockingPageTrustedFilter: IFilter,
        userRules: IFilter,
        customFilters: IFilter[],
        enabledStaticRuleSets: IRuleSet[],
        resourcesPath?: string,
    ): Promise<ConversionResult> {
        const filterList = [
            quickFixesFilter,
            allowlistRules,
            blockingPageTrustedFilter,
            userRules,
            ...customFilters,
        ];

        // Create filter and convert into single rule set
        const converter = new DeclarativeFilterConverter();

        const conversionResult = await converter.convertDynamicRuleSets(
            filterList,
            enabledStaticRuleSets,
            {
                resourcesPath,
                maxNumberOfRules: DynamicRulesApi.MAX_NUMBER_OF_DYNAMIC_RULES,
                maxNumberOfUnsafeRules: DynamicRulesApi.MAX_NUMBER_OF_UNSAFE_DYNAMIC_RULES,
                maxNumberOfRegexpRules: DynamicRulesApi.MAX_NUMBER_OF_REGEX_RULES,
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
            // TODO: (AG-34651) Check, if filter_1 has been enabled and we disable some
            // rules there - should we enable them back before disable filter?
            // Because in other case, when we will re-enable filter - maybe it
            // will contains already disabled rules?
            // Undoes all previously applied changes.
            await this.cancelAllStaticRulesUpdates(enabledStaticRuleSets);
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
            const enableRuleIds = await browser.declarativeNetRequest.getDisabledRuleIds({ rulesetId });

            // And enable all of them.
            return browser.declarativeNetRequest.updateStaticRules({
                rulesetId,
                enableRuleIds,
            });
        });

        try {
            await Promise.all(tasks);
        } catch (e) {
            logger.error('[tsweb.DynamicRulesApi.cancelAllStaticRulesUpdates]: cannot cancel all updates to static rules due to: ', e);
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
            const disabledRuleIds = await browser.declarativeNetRequest.getDisabledRuleIds({ rulesetId });

            // Collect rules which should be enabled.
            const enableRuleIds = disabledRuleIds.filter((id) => !ruleIdsToDisable.includes(id));

            // Filter only that rules which are not disabled already.
            const disableRuleIds = ruleIdsToDisable.filter((id) => !disabledRuleIds.includes(id));

            return browser.declarativeNetRequest.updateStaticRules({
                rulesetId,
                enableRuleIds,
                disableRuleIds,
            });
        });

        try {
            await Promise.all(tasks);
        } catch (e) {
            logger.error('[tsweb.DynamicRulesApi.applyBadFilterRules]: cannot apply updates to static rules due to: ', e);
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
