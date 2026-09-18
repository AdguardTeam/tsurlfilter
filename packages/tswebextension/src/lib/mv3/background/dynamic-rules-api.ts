import browser from 'webextension-polyfill';

import {
    type ConversionResult,
    type DeclarativeRule,
    FilterConverter,
    type IFilter,
    type IRulesetWithSourceMap,
    isCspDeclarativeRule,
    isSafeRule,
    TooManyRegexpRulesError,
    TooManyRulesError,
    TooManyUnsafeRulesError,
    type UpdateStaticRulesOptions,
} from '@adguard/dnr-converter';

import { logger } from '../../common/utils/logger';

/**
 * Narrows {@link ConversionResult} for the dynamic ruleset use case:
 * `declarativeRulesToCancel` is always present (required, not optional) because
 * {@link DynamicRulesApi.updateDynamicFiltering} always computes it via
 * {@link FilterConverter.computeRulesToDisable}.
 */
export type DynamicConversionResult = ConversionResult<IRulesetWithSourceMap> & {
    declarativeRulesToCancel: UpdateStaticRulesOptions[];
};

export type { DynamicConversionResult as ConversionResult };

type LimitedCspRules = {
    rules: DeclarativeRule[];
    limitations: DynamicConversionResult['limitations'];
};

type DynamicRulesSnapshot = {
    rules: browser.DeclarativeNetRequest.Rule[];
    sourceMap: Map<number, [string, number]>;
    disabledStaticRuleIds: Map<string, number[]>;
};

/**
 * DynamicRulesApi knows how to handle dynamic rules: apply a list of custom
 * filters along with user rules, allowlist and quick fixes rules and disable
 * all dynamic rules when the filtration is stopped.
 */
export default class DynamicRulesApi {
    /**
     * Maps runtime dynamic CSP rule IDs to their source ruleset and rule IDs.
     */
    public static readonly sourceMapForCspRules = new Map<number, [string, number]>();

    /**
     * First ID tried when reassigning colliding IDs of rebuilt CSP rules.
     */
    private static readonly FIRST_REASSIGNED_RULE_ID = 2;

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
     * Fits rebuilt CSP rules into quotas left after regular dynamic conversion.
     *
     * @param conversionResult Regular dynamic conversion result.
     * @param rebuiltCspRules Rebuilt dynamic CSP rules.
     *
     * @returns CSP rules that fit and limitations for omitted rules.
     */
    public static limitRebuiltCspRules(
        conversionResult: DynamicConversionResult,
        rebuiltCspRules: DeclarativeRule[],
    ): LimitedCspRules {
        const rules: DeclarativeRule[] = [];
        let totalCount = conversionResult.ruleset.getSafeRulesCount()
            + conversionResult.ruleset.getUnsafeRulesCount();
        let unsafeCount = conversionResult.ruleset.getUnsafeRulesCount();
        let regexpCount = conversionResult.ruleset.getRegexpRulesCount();
        let excludedTotalCount = 0;
        let excludedUnsafeCount = 0;
        let excludedRegexpCount = 0;

        for (const rule of rebuiltCspRules) {
            const isUnsafe = !isSafeRule(rule);
            const isRegexp = rule.condition.regexFilter !== undefined;
            const exceedsTotalLimit = totalCount >= DynamicRulesApi.MAX_NUMBER_OF_DYNAMIC_RULES;
            const exceedsUnsafeLimit = isUnsafe
                && unsafeCount >= DynamicRulesApi.MAX_NUMBER_OF_UNSAFE_DYNAMIC_RULES;
            const exceedsRegexpLimit = isRegexp
                && regexpCount >= DynamicRulesApi.MAX_NUMBER_OF_REGEX_RULES;

            if (exceedsTotalLimit || exceedsUnsafeLimit || exceedsRegexpLimit) {
                excludedTotalCount += Number(exceedsTotalLimit);
                excludedUnsafeCount += Number(isUnsafe && exceedsUnsafeLimit);
                excludedRegexpCount += Number(isRegexp && exceedsRegexpLimit);
                continue;
            }

            rules.push(rule);
            totalCount += 1;
            unsafeCount += Number(isUnsafe);
            regexpCount += Number(isRegexp);
        }

        const limitations: DynamicConversionResult['limitations'] = [];
        if (excludedTotalCount > 0) {
            limitations.push(new TooManyRulesError(
                `Rebuilt CSP rules exceed the dynamic rules limit: ${excludedTotalCount} rules were omitted`,
                [],
                DynamicRulesApi.MAX_NUMBER_OF_DYNAMIC_RULES,
                excludedTotalCount,
            ));
        }
        if (excludedUnsafeCount > 0) {
            limitations.push(new TooManyUnsafeRulesError(
                `Rebuilt CSP rules exceed the unsafe dynamic rules limit: ${excludedUnsafeCount} rules were omitted`,
                [],
                DynamicRulesApi.MAX_NUMBER_OF_UNSAFE_DYNAMIC_RULES,
                excludedUnsafeCount,
            ));
        }
        if (excludedRegexpCount > 0) {
            limitations.push(new TooManyRegexpRulesError(
                `Rebuilt CSP rules exceed the dynamic regexp rules limit: ${excludedRegexpCount} rules were omitted`,
                [],
                DynamicRulesApi.MAX_NUMBER_OF_REGEX_RULES,
                excludedRegexpCount,
            ));
        }

        return { rules, limitations };
    }

    /**
     * Converts custom filters and user rules on the fly into a single merged
     * rule set and applies it via the declarativeNetRequest API.
     *
     * Filters will combine into one in following order:
     * - allowlistRules,
     * - blockingPageTrustedFilter - created on the blocking page by user,
     * - userRules,
     * - customFilters.
     *
     * @param allowlistRules Filter with allowlist rules.
     * @param blockingPageTrustedFilter Filter with blocking page trusted domains rules (badfiltered rules).
     * @param userRules Filter with user rules.
     * @param customFilters List of custom filters.
     * @param enabledStaticRulesets List of enabled static rule sets to apply
     * $badfilter rules from dynamic rules to static.
     * @param resourcesPath String path to web accessible resources,
     * relative to the extension root dir. Should start with leading slash '/'.
     *
     * @returns Converted dynamic rule set with rule set, errors and
     * limitations. @see {@link ConversionResult}.
     *
     * @throws Error if the conversion produces no results (empty filter list).
     * @throws Error if declarativeNetRequest.updateDynamicRules() receives invalid rules
     * e.g. with non-ASCII `urlFilter` value.
     * Details: {@link https://developer.chrome.com/docs/extensions/reference/api/declarativeNetRequest#property-RuleCondition-urlFilter}.
     */
    public static async updateDynamicFiltering(
        allowlistRules: IFilter,
        blockingPageTrustedFilter: IFilter,
        userRules: IFilter,
        customFilters: IFilter[],
        enabledStaticRulesets: IRulesetWithSourceMap[],
        resourcesPath?: string,
    ): Promise<DynamicConversionResult> {
        const conversionResult = await this.prepareDynamicFiltering(
            allowlistRules,
            blockingPageTrustedFilter,
            userRules,
            customFilters,
            enabledStaticRulesets,
            resourcesPath,
        );

        await this.applyDynamicFiltering(conversionResult, enabledStaticRulesets);

        return conversionResult;
    }

    /**
     * Converts dynamic filters without changing browser DNR rules.
     *
     * @param allowlistRules Filter with allowlist rules.
     * @param blockingPageTrustedFilter Filter with blocking page trusted domains rules.
     * @param userRules Filter with user rules.
     * @param customFilters List of custom filters.
     * @param enabledStaticRulesets Enabled static rulesets used for `$badfilter`.
     * @param resourcesPath Path to web-accessible resources.
     * @param excludeCspRules Whether CSP rules will be rebuilt separately.
     *
     * @returns Prepared dynamic conversion result.
     */
    public static async prepareDynamicFiltering(
        allowlistRules: IFilter,
        blockingPageTrustedFilter: IFilter,
        userRules: IFilter,
        customFilters: IFilter[],
        enabledStaticRulesets: IRulesetWithSourceMap[],
        resourcesPath?: string,
        excludeCspRules = false,
    ): Promise<DynamicConversionResult> {
        const filterList = [
            allowlistRules,
            blockingPageTrustedFilter,
            userRules,
            ...customFilters,
        ];

        // Collect $badfilter rules from static rulesets so the converter can
        // skip dynamic rules that are already negated by a static $badfilter.
        const staticBadFilterRules = enabledStaticRulesets
            .flatMap((ruleset) => ruleset.getBadFilterRules());

        const converter = new FilterConverter();

        const results = await converter.convert(
            filterList,
            {
                resourcesPath,
                maxNumberOfRules: DynamicRulesApi.MAX_NUMBER_OF_DYNAMIC_RULES,
                maxNumberOfUnsafeRules: DynamicRulesApi.MAX_NUMBER_OF_UNSAFE_DYNAMIC_RULES,
                maxNumberOfRegexpRules: DynamicRulesApi.MAX_NUMBER_OF_REGEX_RULES,
                withSourceMap: true,
                combine: true,
                badFilterRules: staticBadFilterRules,
                excludeCspRules,
            },
        );

        if (results.length === 0) {
            throw new Error('Dynamic rules conversion produced no results');
        }

        const conversionResult = results[0];
        const { ruleset } = conversionResult;

        // Compute which static rules should be disabled by dynamic $badfilter rules.
        const declarativeRulesToCancel = await converter.computeRulesToDisable(
            [ruleset],
            enabledStaticRulesets,
        );

        return {
            ...conversionResult,
            declarativeRulesToCancel,
        };
    }

    /**
     * Applies a prepared dynamic conversion result.
     *
     * @param conversionResult Prepared dynamic rules.
     * @param enabledStaticRulesets Enabled static rulesets used for `$badfilter`.
     * @param rebuiltCspRules Optional globally rebuilt dynamic CSP rules.
     * @param cspRuleset Source ruleset for rebuilt CSP rules.
     *
     * @returns Snapshot that can restore the previous browser rules.
     */
    public static async applyDynamicFiltering(
        conversionResult: DynamicConversionResult,
        enabledStaticRulesets: IRulesetWithSourceMap[],
        rebuiltCspRules?: DeclarativeRule[],
        cspRuleset?: IRulesetWithSourceMap,
    ): Promise<DynamicRulesSnapshot> {
        const declarativeRules = await conversionResult.ruleset.getDeclarativeRules();
        const rulesWithoutCsp = rebuiltCspRules === undefined
            ? declarativeRules
            : declarativeRules.filter((rule) => !isCspDeclarativeRule(rule));
        // Fit rebuilt CSP rules into the quotas left after regular conversion.
        // Omitted rules are reported by the caller through `limitRebuiltCspRules`,
        // so exceeding a limit here must not fail the whole configuration.
        const limitedCspRules = rebuiltCspRules === undefined
            ? rebuiltCspRules
            : DynamicRulesApi.limitRebuiltCspRules(conversionResult, rebuiltCspRules).rules;
        const {
            rules,
            sourceMap,
        } = DynamicRulesApi.mergeCspRules(rulesWithoutCsp, limitedCspRules, cspRuleset);
        DynamicRulesApi.validateRuleLimits(rules);
        const existingRules = await browser.declarativeNetRequest.getDynamicRules();
        const disabledStaticRuleIds = new Map(await Promise.all(enabledStaticRulesets.map(async (ruleset) => (
            [
                ruleset.getId(),
                await browser.declarativeNetRequest.getDisabledRuleIds({ rulesetId: ruleset.getId() }),
            ] as const
        ))));
        const snapshot: DynamicRulesSnapshot = {
            rules: existingRules,
            sourceMap: new Map(DynamicRulesApi.sourceMapForCspRules),
            disabledStaticRuleIds,
        };

        // Remove the previous rules and add the merged rules in one atomic
        // browser update, so there is no window where dynamic rules are missing.
        // All previous IDs are listed in removeRuleIds, and new IDs are made
        // unique by mergeCspRules, so no collision can occur within the update.
        await browser.declarativeNetRequest.updateDynamicRules({
            removeRuleIds: existingRules.map((rule) => rule.id),
            // TODO update rule types returned by getDeclarativeRules();
            addRules: rules as browser.DeclarativeNetRequest.Rule[],
        });

        DynamicRulesApi.sourceMapForCspRules.clear();
        sourceMap.forEach((source, id) => DynamicRulesApi.sourceMapForCspRules.set(id, source));

        if (conversionResult.declarativeRulesToCancel.length > 0) {
            // Apply $badfilter rules from dynamic filters.
            await this.applyBadFilterRules(conversionResult.declarativeRulesToCancel);
        } else {
            // TODO: (AG-34651) Check, if filter_1 has been enabled and we disable some
            // rules there - should we enable them back before disable filter?
            // Because in other case, when we will re-enable filter - maybe it
            // will contains already disabled rules?
            // Undoes all previously applied changes.
            await this.cancelAllStaticRulesUpdates(enabledStaticRulesets);
        }

        return snapshot;
    }

    /**
     * Restores dynamic rules after a later configuration step fails.
     *
     * @param snapshot Previous browser rules and CSP source map.
     *
     * @returns Promise resolved after the previous rules are restored.
     */
    public static async rollbackDynamicFiltering(snapshot: DynamicRulesSnapshot): Promise<void> {
        const currentRules = await browser.declarativeNetRequest.getDynamicRules();
        await browser.declarativeNetRequest.updateDynamicRules({
            removeRuleIds: currentRules.map((rule) => rule.id),
            addRules: snapshot.rules,
        });

        // Restore the source map together with the dynamic rules so filtering
        // log lookups never resolve old rules through the failed mapping.
        DynamicRulesApi.sourceMapForCspRules.clear();
        snapshot.sourceMap.forEach((source, id) => DynamicRulesApi.sourceMapForCspRules.set(id, source));

        // Restore disabled static rules best-effort: a single ruleset failure
        // must not abort the remaining restores or the whole rollback.
        const results = await Promise.allSettled(
            Array.from(snapshot.disabledStaticRuleIds.entries()).map(async ([rulesetId, previousIds]) => {
                const currentIds = await browser.declarativeNetRequest.getDisabledRuleIds({ rulesetId });
                await browser.declarativeNetRequest.updateStaticRules({
                    rulesetId,
                    enableRuleIds: currentIds.filter((id) => !previousIds.includes(id)),
                    disableRuleIds: previousIds.filter((id) => !currentIds.includes(id)),
                });
            }),
        );

        results.forEach((result) => {
            if (result.status === 'rejected') {
                logger.error('[tsweb.DynamicRulesApi.rollbackDynamicFiltering]: Cannot restore static rules:', result.reason);
            }
        });
    }

    /**
     * Adds rebuilt CSP rules while preserving unique dynamic rule IDs.
     *
     * @param rules Existing non-CSP dynamic rules.
     * @param rebuiltCspRules Rebuilt CSP rules.
     * @param cspRuleset Source ruleset for rebuilt CSP rules.
     *
     * @returns Merged rules and runtime source mapping.
     *
     * @throws If rebuilt CSP rules are provided without their source ruleset.
     */
    private static mergeCspRules(
        rules: DeclarativeRule[],
        rebuiltCspRules?: DeclarativeRule[],
        cspRuleset?: IRulesetWithSourceMap,
    ): { rules: DeclarativeRule[]; sourceMap: Map<number, [string, number]> } {
        if (rebuiltCspRules === undefined) {
            return {
                rules,
                sourceMap: new Map(),
            };
        }

        if (!cspRuleset) {
            throw new Error('CSP source ruleset is required for rebuilt dynamic CSP rules');
        }

        const result = [...rules];
        const usedIds = new Set(result.map((rule) => rule.id));
        const sourceMap = new Map<number, [string, number]>();
        let nextId = DynamicRulesApi.FIRST_REASSIGNED_RULE_ID;

        rebuiltCspRules.forEach((rule) => {
            let { id } = rule;
            while (usedIds.has(id)) {
                while (usedIds.has(nextId)) {
                    nextId += 1;
                }
                id = nextId;
            }

            usedIds.add(id);
            result.push({ ...rule, id });
            sourceMap.set(id, [cspRuleset.getId(), rule.id]);
        });

        return { rules: result, sourceMap };
    }

    /**
     * Checks browser limits after rebuilt CSP rules are merged.
     *
     * @param rules Final dynamic rules.
     *
     * @throws If the final dynamic rules exceed a browser limit.
     */
    private static validateRuleLimits(rules: DeclarativeRule[]): void {
        if (rules.length > DynamicRulesApi.MAX_NUMBER_OF_DYNAMIC_RULES) {
            throw new Error(`Dynamic rules limit exceeded: ${rules.length}`);
        }

        const unsafeRulesCount = rules.filter((rule) => !isSafeRule(rule)).length;
        if (unsafeRulesCount > DynamicRulesApi.MAX_NUMBER_OF_UNSAFE_DYNAMIC_RULES) {
            throw new Error(`Unsafe dynamic rules limit exceeded: ${unsafeRulesCount}`);
        }

        const regexpRulesCount = rules.filter((rule) => rule.condition.regexFilter !== undefined).length;
        if (regexpRulesCount > DynamicRulesApi.MAX_NUMBER_OF_REGEX_RULES) {
            throw new Error(`Dynamic regular expression rules limit exceeded: ${regexpRulesCount}`);
        }
    }

    /**
     * Cancels any disabled rules ids for all static rulesets.
     *
     * @param staticRulesets List of static {@link IRulesetWithSourceMap}.
     */
    private static async cancelAllStaticRulesUpdates(
        staticRulesets: IRulesetWithSourceMap[],
    ): Promise<void> {
        const tasks = staticRulesets.map(async (r) => {
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
        DynamicRulesApi.sourceMapForCspRules.clear();
    }
}
