import { Filter, type IFilter } from '@adguard/tsurlfilter/es/declarative-converter';
import browser from 'webextension-polyfill';

import {
    filterListConversionMapValidator,
    filterListSourceMapValidator,
    type PreprocessedFilterList,
    getFilterBinaryName,
    getFilterConversionMapName,
    getFilterName,
    getFilterSourceMapName,
} from '@adguard/tsurlfilter';
import { ByteBuffer } from '@adguard/agtree';
import { FailedEnableRuleSetsError } from '../errors/failed-enable-rule-sets-error';

import { type ConfigurationMV3 } from './configuration';
import { loadExtensionBinaryResource, loadExtensionTextResource } from '../utils/resource-loader';

export const RULE_SET_NAME_PREFIX = 'ruleset_';

export type UpdateStaticFiltersResult = {
    errors: FailedEnableRuleSetsError[],
};

/**
 * FiltersApi knows how to enable or disable static rule sets (which were built
 * with the extension) and how to create {@link Filter} through
 * loading its contents.
 */
export default class FiltersApi {
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

        const enableRulesetIds = enableFiltersIds?.map((filterId) => `${RULE_SET_NAME_PREFIX}${filterId}`) || [];
        const disableRulesetIds = disableFiltersIds?.map((filterId) => `${RULE_SET_NAME_PREFIX}${filterId}`) || [];

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
        return ruleSets.map((f) => Number.parseInt(f.slice(RULE_SET_NAME_PREFIX.length), 10));
    }

    /**
     * Helper method to load chunks from ArrayBuffer.
     *
     * @param arrayBuffer ArrayBuffer to load chunks from.
     *
     * @returns List of Uint8Array chunks.
     */
    private static async loadChunksFromArrayBuffer(arrayBuffer: ArrayBuffer): Promise<Uint8Array[]> {
        // we can assume that the arrayBuffer.byteLength is divisible by ByteBuffer.CHUNK_SIZE
        const chunkSize = ByteBuffer.CHUNK_SIZE;
        const totalChunks = arrayBuffer.byteLength / chunkSize;

        return Array.from({ length: totalChunks }, (_, i) => {
            const start = i * chunkSize;
            const end = Math.min(start + chunkSize, arrayBuffer.byteLength);
            return new Uint8Array(arrayBuffer.slice(start, end));
        });
    }

    /**
     * Loads filters content from provided filtersPath (which has been extracted
     * from field 'filtersPath' of the {@link Configuration}).
     *
     * @param id Filter id.
     * @param filtersPath Path to filters directory.
     *
     * @returns Promise resolved file content as a list of strings.
     */
    private static async loadFilterContent(id: number, filtersPath: string): Promise<PreprocessedFilterList> {
        const rawFilterPath = `${filtersPath}/${getFilterName(id)}`;
        const binaryFilterPath = `${filtersPath}/${getFilterBinaryName(id)}`;
        const conversionMapPath = `${filtersPath}/${getFilterConversionMapName(id)}`;
        const sourceMapPath = `${filtersPath}/${getFilterSourceMapName(id)}`;

        const [rawFilterList, filterList, conversionMap, sourceMap] = await Promise.all([
            // TODO (David): store raw filter list in byte-encoded form
            loadExtensionTextResource(rawFilterPath),
            loadExtensionBinaryResource(binaryFilterPath).then(this.loadChunksFromArrayBuffer),
            loadExtensionTextResource(conversionMapPath).then(JSON.parse).then(filterListConversionMapValidator.parse),
            loadExtensionTextResource(sourceMapPath).then(JSON.parse).then(filterListSourceMapValidator.parse),
        ]);

        return {
            rawFilterList,
            filterList,
            conversionMap,
            sourceMap,
        };
    }

    /**
     * Loads content for provided filters ids;.
     *
     * @param filtersIds List of filters ids.
     * @param filtersPath Path to filters directory.
     *
     * @returns List of {@link IFilter} with a lazy content loading feature.
     */
    static createStaticFilters(
        filtersIds: ConfigurationMV3['staticFiltersIds'],
        filtersPath: string,
    ): IFilter[] {
        return filtersIds.map((filterId) => new Filter(
            filterId,
            { getContent: () => this.loadFilterContent(filterId, filtersPath) },
            /**
             * Static filters are trusted.
             */
            true,
        ));
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
                getContent: () => Promise.resolve({
                    rawFilterList: f.rawFilterList,
                    filterList: f.content,
                    conversionMap: f.conversionMap,
                    sourceMap: f.sourceMap ?? {},
                }),
            },
            true,
        ));
    }
}
