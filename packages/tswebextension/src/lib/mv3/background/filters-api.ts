import browser from 'webextension-polyfill';

import { getErrorMessage } from '@adguard/logger';
import { FilterList } from '@adguard/tsurlfilter';
import { Filter, type IFilter, RULESET_NAME_PREFIX } from '@adguard/tsurlfilter/es/declarative-converter';

import { FiltersStorage } from '../../common/storage/filters';
import { FailedEnableRuleSetsError } from '../errors/failed-enable-rule-sets-error';

import { type ConfigurationMV3 } from './configuration';

export type UpdateStaticFiltersResult = {
    errors: FailedEnableRuleSetsError[];
};

/**
 * FiltersApi knows how to enable or disable static rule sets (which were built
 * with the extension) and how to create {@link Filter} through
 * loading its contents.
 */
export default class FiltersApi {
    /**
     * Cache for already created filters. Needed to avoid multiple loading
     * of the same filter.
     */
    private static filtersCache: Map<number, IFilter> = new Map();

    /**
     * Enables or disables the provided rule set identifiers.
     *
     * Disables are applied in a single batch call first, then each ruleset
     * is enabled individually so that one invalid ruleset does not prevent
     * the others from being enabled (the browser rejects the entire batch
     * when any single ruleset in the request is not found).
     *
     * @param disableFiltersIds Rule sets to disable.
     * @param enableFiltersIds Rule sets to enable.
     *
     * @returns Promise resolved with result of updating {@link UpdateStaticFiltersResult}.
     *
     * @note Errors for individual rulesets are collected and returned in
     * the result rather than thrown.
     * @note If the disable batch fails, enables still proceed. This is
     * intentional — a disable failure should not block unrelated enables.
     * However, callers that disable rulesets to free up rule budget before
     * enabling new ones should be aware that a disable failure may cause
     * subsequent enables to exceed Chrome's static rule limit.
     */
    static async updateFiltering(
        disableFiltersIds: number[],
        enableFiltersIds?: number[],
    ): Promise<UpdateStaticFiltersResult> {
        const res: UpdateStaticFiltersResult = {
            errors: [],
        };

        const enableRulesetIds = enableFiltersIds?.map((filterId) => `${RULESET_NAME_PREFIX}${filterId}`) || [];
        const disableRulesetIds = disableFiltersIds?.map((filterId) => `${RULESET_NAME_PREFIX}${filterId}`) || [];

        // Nothing to do — skip the API call entirely.
        if (disableRulesetIds.length === 0 && enableRulesetIds.length === 0) {
            return res;
        }

        // Disable rulesets in a single batch call first.
        if (disableRulesetIds.length > 0) {
            try {
                await browser.declarativeNetRequest.updateEnabledRulesets({
                    disableRulesetIds,
                });
            } catch (e) {
                const msg = 'Cannot disable rule sets';
                const err = new FailedEnableRuleSetsError(
                    msg,
                    [],
                    disableRulesetIds,
                    e instanceof Error ? e : new Error(getErrorMessage(e)),
                );
                res.errors.push(err);
            }
        }

        // Enable rulesets independently so that one bad ruleset does not
        // block all the others.
        if (enableRulesetIds.length > 0) {
            const enableResults = await Promise.allSettled(
                enableRulesetIds.map((rulesetId) => browser.declarativeNetRequest.updateEnabledRulesets({
                    enableRulesetIds: [rulesetId],
                })),
            );

            enableResults.forEach((result, index) => {
                if (result.status === 'rejected') {
                    const rulesetId = enableRulesetIds[index];
                    const msg = 'Cannot enable rule set';
                    const err = new FailedEnableRuleSetsError(
                        msg,
                        [rulesetId],
                        [],
                        result.reason instanceof Error ? result.reason : new Error(getErrorMessage(result.reason)),
                    );
                    res.errors.push(err);
                }
            });
        }

        return res;
    }

    /**
     * Returns current enabled rule sets IDs.
     *
     * @returns List of extracted enabled rule sets ids.
     */
    public static async getEnabledRuleSets(): Promise<number[]> {
        const ruleSets = await browser.declarativeNetRequest.getEnabledRulesets();
        return ruleSets.map((f) => Number.parseInt(f.slice(RULESET_NAME_PREFIX.length), 10));
    }

    /**
     * Wraps static filters into {@link IFilter}.
     *
     * @param filtersIds List of filters ids.
     *
     * @returns List of {@link IFilter} with a lazy content loading feature.
     */
    static createStaticFilters(
        filtersIds: ConfigurationMV3['staticFiltersIds'],
    ): IFilter[] {
        return filtersIds.map((filterId) => {
            const filterFromCache = this.filtersCache.get(filterId);
            if (filterFromCache) {
                return filterFromCache;
            }

            const filter = new Filter(
                filterId,
                { getContent: (): Promise<FilterList> => FiltersApi.loadFilterContent(filterId) },
                /**
                 * Static filters are trusted.
                 */
                true,
            );

            this.filtersCache.set(filterId, filter);

            return filter;
        });
    }

    /**
     * Wraps custom filter into {@link IFilter}.
     *
     * @param customFilters List of custom filters.
     *
     * @returns List of {@link IFilter} with a lazy content loading feature.
     */
    static createCustomFilters(customFilters: ConfigurationMV3['customFilters']): IFilter[] {
        return customFilters.map((f) => new Filter(
            f.filterId,
            {
                getContent: () => Promise.resolve(new FilterList(f.content, f.conversionData)),
            },
            f.trusted,
        ));
    }

    /**
     * Loads filter content by filter id.
     *
     * @param filterId Filter identifier to load content for.
     *
     * @returns Promise that resolves to the filter content (see {@link FilterList})
     * or null if the filter is not found.
     *
     * @throws Error if the filter content cannot be loaded.
     */
    public static loadFilterContent = async (filterId: number): Promise<FilterList> => {
        try {
            const result = await FiltersStorage.get(filterId);

            if (!result) {
                throw new Error(`Filter with id ${filterId} not found`);
            }

            return new FilterList(result.rawFilterList, result.conversionData);
        } catch (e) {
            throw new Error(`Failed to load filter content: ${e}`);
        }
    };
}
