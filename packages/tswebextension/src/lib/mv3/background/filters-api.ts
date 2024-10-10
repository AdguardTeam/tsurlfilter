import {
    Filter,
    type IFilter,
    RULESET_NAME_PREFIX,
    RuleSetByteRangeCategory,
} from '@adguard/tsurlfilter/es/declarative-converter';
import browser from 'webextension-polyfill';

import {
    type PreprocessedFilterList,
} from '@adguard/tsurlfilter';
import { FailedEnableRuleSetsError } from '../errors/failed-enable-rule-sets-error';

import { type ConfigurationMV3 } from './configuration';
import { type RuleSetsLoaderApi } from './rule-sets-loader-api';

export type UpdateStaticFiltersResult = {
    errors: FailedEnableRuleSetsError[],
};

// TODO: Remove this after we added a logic that creates byte buffers to IDB after extension updates
/**
 * Converts base64 to Uint8Array.
 *
 * @param base64 Base64 string to convert.
 *
 * @returns Uint8Array.
 */
export function base64ToUint8Array(base64: string): Uint8Array {
    const binary = atob(base64);
    const uint8Array = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i += 1) {
        uint8Array[i] = binary.charCodeAt(i);
    }
    return uint8Array;
}

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
    static filtersCache: Map<number, IFilter> = new Map();

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
     * Loads filters content from provided filtersPath (which has been extracted
     * from field 'filtersPath' of the {@link Configuration}).
     *
     * @param id Filter id.
     * @param ruleSetsLoaderApi RuleSetsLoaderApi instance.
     *
     * @returns Promise resolved file content as a list of strings.
     */
    private static async loadFilterContent(
        id: number,
        ruleSetsLoaderApi: RuleSetsLoaderApi,
    ): Promise<PreprocessedFilterList> {
        // TODO: Add a logic that creates byte buffers to IDB after extension updates
        const ruleSetId = `${RULESET_NAME_PREFIX}${id}`;

        // Trigger all async requests concurrently
        const [rawFilterList, conversionMap, sourceMap, filterListBase64] = await Promise.all([
            /* eslint-disable max-len */
            ruleSetsLoaderApi.getRawCategoryContent(ruleSetId, RuleSetByteRangeCategory.PreprocessedFilterListRaw).then(JSON.parse),
            ruleSetsLoaderApi.getRawCategoryContent(ruleSetId, RuleSetByteRangeCategory.PreprocessedFilterListConversionMap).then(JSON.parse),
            ruleSetsLoaderApi.getRawCategoryContent(ruleSetId, RuleSetByteRangeCategory.PreprocessedFilterListSourceMap).then(JSON.parse),
            ruleSetsLoaderApi.getRawCategoryContent(ruleSetId, RuleSetByteRangeCategory.PreprocessedFilterListBinary).then(JSON.parse),
            /* eslint-enable max-len */
        ]);

        // Convert the base64 encoded filter list to Uint8Array
        const filterList = filterListBase64.map(base64ToUint8Array);

        return {
            rawFilterList,
            filterList,
            conversionMap,
            sourceMap,
        };
    }

    /**
     * Wraps static filters into {@link IFilter}.
     *
     * @param filtersIds List of filters ids.
     * @param ruleSetsLoaderApi RuleSetsLoaderApi instance.
     *
     * @returns List of {@link IFilter} with a lazy content loading feature.
     */
    static createStaticFilters(
        filtersIds: ConfigurationMV3['staticFiltersIds'],
        ruleSetsLoaderApi: RuleSetsLoaderApi,
    ): IFilter[] {
        return filtersIds.map((filterId) => {
            const filterFromCache = this.filtersCache.get(filterId);
            if (filterFromCache) {
                return filterFromCache;
            }

            const filter = new Filter(
                filterId,
                { getContent: () => this.loadFilterContent(filterId, ruleSetsLoaderApi) },
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
}
