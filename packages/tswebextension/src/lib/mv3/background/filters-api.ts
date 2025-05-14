import zod from 'zod';
import { Filter, type IFilter, RULESET_NAME_PREFIX } from '@adguard/tsurlfilter/es/declarative-converter';
import browser from 'webextension-polyfill';
import { type PreprocessedFilterList, preprocessedFilterListValidator } from '@adguard/tsurlfilter';

import { FailedEnableRuleSetsError } from '../errors/failed-enable-rule-sets-error';
import { FiltersStorage } from '../../common/storage/filters';

import { type ConfigurationMV3 } from './configuration';

export type UpdateStaticFiltersResult = {
    errors: FailedEnableRuleSetsError[];
};

const loadFilterContentValidator = zod.function()
    .args(zod.number())
    .returns(
        zod.promise(
            preprocessedFilterListValidator,
        ),
    );

/**
 * Lazy load filter content.
 *
 * @param filterId Filter identifier to load content for.
 *
 * @returns Promise that resolves to the filter content (see {@link PreprocessedFilterList})
 * or null if the filter is not found.
 *
 * @throws Error if the filter content cannot be loaded.
 */
export type LoadFilterContent = zod.infer<typeof loadFilterContentValidator>;

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
            const err = new FailedEnableRuleSetsError(
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
    public static async getEnabledRuleSets(): Promise<number[]> {
        const ruleSets = await browser.declarativeNetRequest.getEnabledRulesets();
        return ruleSets.map((f) => Number.parseInt(f.slice(RULESET_NAME_PREFIX.length), 10));
    }

    /**
     * Wraps static filters into {@link IFilter}.
     *
     * @param filtersIds List of filters ids.
     * @param loadFilterContent Function to load filter content.
     *
     * @returns List of {@link IFilter} with a lazy content loading feature.
     */
    static createStaticFilters(
        filtersIds: ConfigurationMV3['staticFiltersIds'],
        loadFilterContent: LoadFilterContent,
    ): IFilter[] {
        return filtersIds.map((filterId) => {
            const filterFromCache = this.filtersCache.get(filterId);
            if (filterFromCache) {
                return filterFromCache;
            }

            const filter = new Filter(
                filterId,
                { getContent: (): Promise<PreprocessedFilterList> => loadFilterContent(filterId) },
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
                getContent: () => Promise.resolve(f),
            },
            f.trusted,
        ));
    }

    /**
     * Loads filter content by filter id.
     *
     * @param filterId Filter identifier to load content for.
     *
     * @returns Promise that resolves to the filter content (see {@link PreprocessedFilterList})
     * or null if the filter is not found.
     *
     * @throws Error if the filter content cannot be loaded.
     */
    public static loadFilterContent = async (filterId: number): Promise<PreprocessedFilterList> => {
        try {
            const result = await FiltersStorage.get(filterId);

            if (!result) {
                throw new Error(`Filter with id ${filterId} not found`);
            }

            return result;
        } catch (e) {
            throw new Error(`Failed to load filter content: ${e}`);
        }
    };
}
