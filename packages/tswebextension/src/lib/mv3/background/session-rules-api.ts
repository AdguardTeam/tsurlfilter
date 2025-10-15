import {
    type DeclarativeRule,
    type IRuleSet,
    type UpdateStaticRulesOptions,
} from '@adguard/tsurlfilter/es/declarative-converter';
import browser from 'webextension-polyfill';

import { logger } from '../../common/utils/logger';

/**
 * SessionRulesApi knows how to handle sessions rules: apply rules from tracking
 * protection and how to apply unsafe rules from static rulesets.
 */
export class SessionRulesApi {
    /**
     * To prevent conflicts we reserve rule ids for stealth rules.
     *
     * Use with {@link StealthRuleId} enum to freeze rule ids for Tracking
     * protection rules.
     */
    public static readonly MIN_DECLARATIVE_RULE_ID = 4;

    /**
     * Contains a mapping of session rule ids to their unsafe rules source:
     * ruleset id and rule id inside this ruleset. It will be used to show
     * original applied rule in the UI.
     */
    public static readonly sourceMapForUnsafeRules = new Map<number, [string, number]>();

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
     * The maximum number of session rules (safe and unsafe) an extension can add.
     *
     * In Chrome before v120, this limit is enforced for the combination of dynamic and session scoped rules.
     * In Firefox and Chrome (staring v121), each ruleset has its own quota.
     *
     * @returns Maximum number of session rules.
     */
    private static get MAX_NUMBER_OF_SESSION_RULES(): number {
        return browser.declarativeNetRequest.MAX_NUMBER_OF_SESSION_RULES;
    }

    /**
     * The maximum number of **unsafe** dynamic rules an extension can add.
     *
     * @see {@link https://developer.chrome.com/docs/extensions/reference/api/declarativeNetRequest#property-MAX_NUMBER_OF_UNSAFE_SESSION_RULES}
     *
     * @returns Maximum number of dynamic **unsafe** rules.
     */
    private static get MAX_NUMBER_OF_UNSAFE_SESSION_RULES(): number {
        // Replace chrome.declarativeNetRequest.MAX_NUMBER_OF_UNSAFE_SESSION_RULES
        // with webextension-polyfill later, when the value becomes available.
        return chrome.declarativeNetRequest.MAX_NUMBER_OF_UNSAFE_SESSION_RULES;
    }

    /**
     * Set the stealth rule in the session ruleset.
     * If the rule with the same id already exists, it will be replaced.
     *
     * @param rule Session rule to set.
     *
     * @returns Resolved promise when the rule is set.
     */
    public static async setStealthRule(
        rule: chrome.declarativeNetRequest.Rule,
    ): Promise<void> {
        // The rules with IDs listed in options.removeRuleIds are first removed,
        // and then the rules given in options.addRules are added
        return chrome.declarativeNetRequest.updateSessionRules({
            addRules: [rule],
            removeRuleIds: [rule.id],
        });
    }

    /**
     * Remove the stealth rule from the session ruleset.
     *
     * @param ruleId Session rule id.
     *
     * @returns Resolved promise when the rule is removed.
     */
    public static async removeStealthRule(ruleId: number): Promise<void> {
        return chrome.declarativeNetRequest.updateSessionRules({
            removeRuleIds: [ruleId],
        });
    }

    /**
     * Remove the stealth rules from the session ruleset.
     *
     * @param ruleIds Array of session rule ids to remove.
     *
     * @returns Resolved promise when the rules are removed.
     */
    public static async removeStealthRules(ruleIds: number[]): Promise<void> {
        return chrome.declarativeNetRequest.updateSessionRules({
            removeRuleIds: ruleIds,
        });
    }

    /**
     * Update session rules with unsafe rules from static filters. If we overflow
     * the limit of session rules, some rules will be ignored.
     *
     * @param enabledStaticRuleSets List of enabled static rule sets.
     * @param declarativeRulesToCancel List of declarative rules to cancel
     * (collected from dynamic rules).
     *
     * @returns Resolved promise when the session rules are updated.
     */
    public static async updateSessionRules(
        enabledStaticRuleSets: IRuleSet[],
        declarativeRulesToCancel?: UpdateStaticRulesOptions[] | undefined,
    ): Promise<void> {
        const rulesToCancel = new Map<string, number[]>(
            declarativeRulesToCancel
                ? declarativeRulesToCancel.map(({ rulesetId, disableRuleIds }) => [rulesetId, disableRuleIds])
                : [],
        );

        // Apply $badfilter rules from dynamic rules to static rules.
        const unsafeRulesFromStaticFilters = await Promise.all(
            enabledStaticRuleSets.map(async (r) => {
                const rules = await r.getUnsafeRules();

                const rulesToRemove = rulesToCancel.get(r.getId()) || [];

                return {
                    rulesetId: r.getId(),
                    rules: rules.filter((rule) => !rulesToRemove.includes(rule.id)),
                };
            }),
        );

        // Collect rules to enable.
        const unsafeRulesFromEnabledRulesets: DeclarativeRule[] = [];

        // TODO: Add separated counters for these in ruleset.
        let regexpRulesCounter = 0;
        const ignoredRules = new Map<string, number[]>(
            enabledStaticRuleSets.map((r) => [r.getId(), []]),
        );

        let availableId = SessionRulesApi.MIN_DECLARATIVE_RULE_ID + 1;

        // Reset id for each rule via saving it's source and check the limits.
        unsafeRulesFromStaticFilters.forEach(({ rulesetId, rules }) => {
            rules.forEach((rule) => {
                if (availableId > SessionRulesApi.MAX_NUMBER_OF_UNSAFE_SESSION_RULES) {
                    ignoredRules.get(rulesetId)?.push(rule.id);

                    return;
                }

                // TODO: Add separated counters for these in ruleset.
                if (rule.condition?.regexFilter) {
                    regexpRulesCounter += 1;

                    if (regexpRulesCounter > SessionRulesApi.MAX_NUMBER_OF_REGEX_RULES) {
                        ignoredRules.get(rulesetId)?.push(rule.id);

                        return;
                    }
                }

                SessionRulesApi.sourceMapForUnsafeRules.set(
                    availableId,
                    [rulesetId, rule.id],
                );

                // Add the rule to the session rules.
                unsafeRulesFromEnabledRulesets.push({ ...rule, id: availableId });

                availableId += 1;
            });
        });

        // Pretty print ignored rules, if any.
        if (ignoredRules.values().some((rules) => rules.length > 0)) {
            const stringifiedIgnoredRules = Array.from(ignoredRules.entries())
                .map(([rulesetId, rules]) => {
                    return `${rulesetId}: ${rules.join(', ')}`;
                })
                .join(';\n');

            logger.debug(`[tsweb.SessionRulesApi.updateSessionRules]: Some session rules were ignored due to the limit of ${SessionRulesApi.MAX_NUMBER_OF_UNSAFE_SESSION_RULES} (current count of unsafe rules: ${unsafeRulesFromEnabledRulesets}) or limit of ${SessionRulesApi.MAX_NUMBER_OF_REGEX_RULES} regex rules (current count of regex rules: ${regexpRulesCounter}): \n`, stringifiedIgnoredRules);
        }

        const currentSessionRules = await chrome.declarativeNetRequest.getSessionRules();

        const removeRuleIds = currentSessionRules
            .map((rule) => rule.id)
            // Ignore removing stealth rules.
            .filter((id) => id > SessionRulesApi.MIN_DECLARATIVE_RULE_ID);

        // Clear them from in-memory source map.
        removeRuleIds.forEach((id) => {
            SessionRulesApi.sourceMapForUnsafeRules.delete(id);
        });

        // The rules with IDs listed in options.removeRuleIds are first removed,
        // and then the rules given in options.addRules are added
        return chrome.declarativeNetRequest.updateSessionRules({
            addRules: unsafeRulesFromEnabledRulesets as chrome.declarativeNetRequest.Rule[],
            removeRuleIds,
        });
    }

    /**
     * Clears all session rules from browser and in-memory source map.
     */
    public static async removeAllRules(): Promise<void> {
        const sessionRules = await chrome.declarativeNetRequest.getSessionRules();

        await chrome.declarativeNetRequest.updateSessionRules({
            removeRuleIds: sessionRules.map((rule) => rule.id),
        });

        SessionRulesApi.sourceMapForUnsafeRules.clear();
    }
}
