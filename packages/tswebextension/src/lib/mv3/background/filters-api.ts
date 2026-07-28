import browser from 'webextension-polyfill';

import { Filter, type IFilter, RULESET_NAME_PREFIX } from '@adguard/dnr-converter';
import { FilterList } from '@adguard/tsurlfilter';

import { FiltersStorage } from '../../common/storage/filters';
import { FailedEnableRulesetsError } from '../errors/failed-enable-rulesets-error';

import { type ConfigurationMV3 } from './configuration';
import { type ITrustedFilter, TrustedFilter } from './trusted-filter';

export type UpdateStaticFiltersResult = {
    errors: FailedEnableRulesetsError[];
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
     * @param disableFiltersIds Rule sets to disable.
     * @param enableFiltersIds Rule sets to enable.
     *
     * @returns Promise resolved with result of updating {@link UpdateStaticFiltersResult}.
     *
     * @note If browser.declarativeNetRequest.updateEnabledRulesets fails,
     * the error will be caught and returned in the result rather than thrown.
     * The browser does not update and even not enable any rulesets if any
     * single ruleset in the request is not found.
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

        try {
            await browser.declarativeNetRequest.updateEnabledRulesets({
                enableRulesetIds,
                disableRulesetIds,
            });
        } catch (e) {
            const msg = 'Cannot change list of enabled rule sets';
            const err = new FailedEnableRulesetsError(
                msg,
                enableRulesetIds,
                disableRulesetIds,
                e as Error,
            );
            res.errors.push(err);
        }

        return res;
    }

    /**
     * Returns current enabled rule sets IDs.
     *
     * @returns List of extracted enabled rule sets ids.
     */
    public static async getEnabledRulesets(): Promise<number[]> {
        const rulesets = await browser.declarativeNetRequest.getEnabledRulesets();
        return rulesets.map((f) => Number.parseInt(f.slice(RULESET_NAME_PREFIX.length), 10));
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
                async (): Promise<string> => {
                    const f = await FiltersApi.loadFilterContent(filterId);

                    return f.getContent();
                },
            );

            this.filtersCache.set(filterId, filter);

            return filter;
        });
    }

    /**
     * Wraps custom filter into {@link ITrustedFilter}.
     *
     * @param customFilters List of custom filters.
     *
     * @returns List of {@link ITrustedFilter} with a lazy content loading feature.
     */
    static createCustomFilters(customFilters: ConfigurationMV3['customFilters']): ITrustedFilter[] {
        return customFilters.map((f) => {
            const filterList = new FilterList(
                f.content,
                f.filterId,
                f.conversionData,
            );
            return new TrustedFilter(
                f.filterId,
                filterList.getContent(),
                f.trusted,
                filterList.getConversionErrors(),
            );
        });
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

            return new FilterList(result.rawFilterList, filterId, result.conversionData);
        } catch (e) {
            throw new Error(`Failed to load filter content: ${e}`);
        }
    };
}
