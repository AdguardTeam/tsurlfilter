import zod from 'zod';
import {
    Filter,
    type IFilter,
    RULESET_NAME_PREFIX,
    RuleSetByteRangeCategory,
} from '@adguard/tsurlfilter/es/declarative-converter';
import browser from 'webextension-polyfill';
import {
    FilterListPreprocessor,
    type PreprocessedFilterList,
    preprocessedFilterListValidator,
} from '@adguard/tsurlfilter';
import { getRuleSetId } from '@adguard/tsurlfilter/es/declarative-converter-utils';

import { FailedEnableRuleSetsError } from '../errors/failed-enable-rule-sets-error';
import { FiltersStorage, type PreprocessedFilterListWithChecksum } from '../../common/storage/filters';
import { getErrorMessage } from '../../common/error';
import { logger } from '../../common/utils/logger';

import { type ConfigurationMV3 } from './configuration';
import { RuleSetsLoaderApi } from './rule-sets-loader-api';

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
                { getContent: () => loadFilterContent(filterId) },
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
     * Helper method to stringify filter ids.
     *
     * @param filterIds Filter identifiers to stringify.
     *
     * @returns Comma-separated string of filter ids or 'none' if the list is empty.
     */
    private static stringifyFilterIds(filterIds: number[]): string {
        if (filterIds.length === 0) {
            return 'none';
        }

        return filterIds.join(', ');
    }

    /**
     * Syncs specified filters with the extension storage.
     *
     * This method updates the extension storage with the latest filter content.
     *
     * @param filterIds Filter identifiers to sync.
     * @param ruleSetsPath Path to the rulesets.
     *
     * @returns Promise that resolves when the sync is finished.
     */
    public static async syncFiltersWithStorage(filterIds: number[], ruleSetsPath: string): Promise<void> {
        logger.info('Syncing enabled filters with the extension storage');

        const filtersToSync: Record<number, PreprocessedFilterListWithChecksum> = {};
        const filtersInStorage = new Set(await FiltersStorage.getFilterIds());
        const filtersToRemove = Array.from(filtersInStorage).filter((id) => !filterIds.includes(id));

        const syncStatus = {
            unchanged: [] as number[],
            added: [] as number[],
            updated: [] as number[],
        };

        // Process each filter ID to determine its status and update if needed
        await Promise.all(
            filterIds.map(async (filterId) => {
                try {
                    const [currentChecksum, storedChecksum] = await Promise.all([
                        FiltersApi.getChecksum(filterId, ruleSetsPath),
                        FiltersStorage.getChecksum(filterId),
                    ]);

                    if (currentChecksum === storedChecksum) {
                        syncStatus.unchanged.push(filterId);
                        return;
                    }

                    if (currentChecksum === undefined) {
                        logger.error(`Failed to get checksum for filter with id ${filterId}`);
                        return;
                    }

                    const preprocessedFilter = await FiltersApi.getPreprocessedFilterList(filterId, ruleSetsPath);
                    filtersToSync[filterId] = {
                        ...preprocessedFilter,
                        checksum: currentChecksum,
                    };

                    if (filtersInStorage.has(filterId)) {
                        syncStatus.updated.push(filterId);
                    } else {
                        syncStatus.added.push(filterId);
                    }
                } catch (error) {
                    logger.error(`Failed to update filter with id ${filterId}. Error: ${getErrorMessage(error)}`);
                }
            }),
        );

        // Persist changes to storage
        if (Object.keys(filtersToSync).length > 0) {
            await FiltersStorage.setMultiple(filtersToSync);
        }

        if (filtersToRemove.length > 0) {
            await FiltersStorage.removeMultiple(filtersToRemove);
        }

        logger.info(
            // eslint-disable-next-line max-len
            `Synced static rulesets with the extension storage. Added: ${FiltersApi.stringifyFilterIds(syncStatus.added)}. Updated: ${FiltersApi.stringifyFilterIds(syncStatus.updated)}. Removed: ${FiltersApi.stringifyFilterIds(filtersToRemove)}. Unchanged: ${FiltersApi.stringifyFilterIds(syncStatus.unchanged)}`,
        );
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

    /**
     * Retrieves the raw filter list.
     *
     * @param filterId Filter id.
     * @param ruleSetsPath Path to the rule sets.
     *
     * @returns Raw filter list.
     *
     * @throws Error if rule sets path is not set.
     */
    public static getRawFilterList = async (
        filterId: number,
        ruleSetsPath: string,
    ): Promise<string> => {
        const ruleSetsLoaderApi = new RuleSetsLoaderApi(ruleSetsPath);
        const ruleSetId = getRuleSetId(filterId);

        return ruleSetsLoaderApi.getRawCategoryContent(
            ruleSetId,
            RuleSetByteRangeCategory.PreprocessedFilterListRaw,
        ).then(JSON.parse);
    };

    /**
     * Retrieves the preprocessed filter list.
     *
     * @param filterId Filter id.
     * @param ruleSetsPath Path to the rule sets.
     *
     * @returns Preprocessed filter list.
     *
     * @throws Error if rule sets path is not set.
     *
     * @note You can learn more about the preprocessed filter list in
     * {@link https://github.com/AdguardTeam/tsurlfilter/tree/master/packages/tsurlfilter#preprocessedfilterlist-interface|tsurlfilter documentation}.
     */
    public static getPreprocessedFilterList = async (
        filterId: number,
        ruleSetsPath: string,
    ): Promise<PreprocessedFilterList> => {
        const ruleSetsLoaderApi = new RuleSetsLoaderApi(ruleSetsPath);
        const ruleSetId = getRuleSetId(filterId);

        const [rawFilterList, conversionMap] = await Promise.all([
            ruleSetsLoaderApi.getRawCategoryContent(
                ruleSetId,
                RuleSetByteRangeCategory.PreprocessedFilterListRaw,
            ).then(JSON.parse),

            ruleSetsLoaderApi.getRawCategoryContent(
                ruleSetId,
                RuleSetByteRangeCategory.PreprocessedFilterListConversionMap,
            ).then(JSON.parse),
        ]);

        return FilterListPreprocessor.preprocessLightweight({
            rawFilterList,
            conversionMap,
        });
    };

    /**
     * Gets the checksums of the rule sets.
     *
     * @param ruleSetId Rule set id.
     * @param ruleSetsPath Path to the rule sets.
     *
     * @returns Checksums of the rule sets.
     *
     * @throws If the rule sets loader is not initialized or the checksum for the specified rule set is not found.
     */
    public static getChecksum(ruleSetId: string | number, ruleSetsPath: string): Promise<string | undefined> {
        const ruleSetsLoaderApi = new RuleSetsLoaderApi(ruleSetsPath);

        return ruleSetsLoaderApi.getChecksum(ruleSetId);
    }
}
