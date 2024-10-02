import {
    extractMetadataContent, Filter, type IFilter,
} from '@adguard/tsurlfilter/es/declarative-converter';
import browser from 'webextension-polyfill';

import {
    type PreprocessedFilterList,
} from '@adguard/tsurlfilter';
import { ByteBuffer } from '@adguard/agtree';
import { FailedEnableRuleSetsError } from '../errors/failed-enable-rule-sets-error';

import { type ConfigurationMV3 } from './configuration';

export const RULE_SET_NAME_PREFIX = 'ruleset_';

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
        // TODO: Add a logic that creates byte buffers to IDB after extension updates
        // to avoid reading files every time
        const ruleSetPath = `${filtersPath}/declarative/ruleset_${id}/ruleset_${id}.json`;
        const ruleSetContent = await extractMetadataContent(ruleSetPath);

        const {
            rawFilterList,
            conversionMap,
            sourceMap,
        } = ruleSetContent;

        const filterList = ruleSetContent.filterList.map(base64ToUint8Array);

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
                getContent: () => Promise.resolve(f),
            },
            f.trusted,
        ));
    }
}
