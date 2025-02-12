import { type PreprocessedFilterList } from '@adguard/tsurlfilter';

import { logger } from '../utils/logger';

import { IDBStorage } from './core/idb-storage';

/**
 * The name of the IndexedDB database for AdGuard API.
 */
const TSWEBEXTENSION_IDB_NAME = 'tswebextensionIDB';

/**
 * The name of the filters database within the AdGuard API IndexedDB.
 */
const TSWEBEXTENSION_FILTERS_DB_NAME = 'filters';

/**
 * An instance of IDBStorage for storing filter data.
 */
export const filtersIdbStorage = new IDBStorage(
    TSWEBEXTENSION_FILTERS_DB_NAME,
    IDBStorage.DEFAULT_IDB_VERSION,
    TSWEBEXTENSION_IDB_NAME,
);

/**
 * Preprocessed filter list extended with checksum.
 */
export type PreprocessedFilterListWithChecksum = PreprocessedFilterList & { checksum: string };

/**
 * Provides a storage for filter lists.
 * It is built on top of {@link filtersIdbStorage}.
 */
export class FiltersStorage {
    private static readonly KEY_COMBINER = '_';

    private static readonly KEY_FILTER_LIST = 'filterList';

    private static readonly KEY_RAW_FILTER_LIST = 'rawFilterList';

    private static readonly KEY_CONVERSION_MAP = 'conversionMap';

    private static readonly KEY_SOURCE_MAP = 'sourceMap';

    private static readonly KEY_CHECKSUM = 'checksum';

    /**
     * Returns key with prefix.
     * Key format: <prefix>_<filterId>, e.g. `filterList_1`.
     *
     * @param keyPrefix Key prefix.
     * @param filterId Filter id.
     *
     * @returns Key with prefix.
     */
    private static getKey(keyPrefix: string, filterId: number | string): string {
        return `${keyPrefix}${FiltersStorage.KEY_COMBINER}${filterId}`;
    }

    /**
     * Sets multiple filter lists to {@link filtersIdbStorage} in batch.
     *
     * @param filters Record with filter id as a key and filter rules strings as a value.
     *
     * @throws Error, if transaction failed.
     */
    public static async setMultiple(filters: Record<number, PreprocessedFilterListWithChecksum>): Promise<void> {
        const data: Record<string, unknown> = {};

        for (const [filterId, filter] of Object.entries(filters)) {
            for (const [key, value] of Object.entries(filter)) {
                data[FiltersStorage.getKey(key, filterId)] = value;
            }
        }

        try {
            const succeeded = await filtersIdbStorage.setMultiple(data);
            if (!succeeded) {
                throw new Error('Transaction failed');
            }
        } catch (e) {
            logger.error('Failed to set multiple filter data, got error:', e);
            throw e;
        }
    }

    /**
     * Checks if the filter list with the specified ID exists in the storage.
     *
     * @param filterId Filter id.
     *
     * @returns `true` if the filter list exists, `false` otherwise.
     */
    public static async has(filterId: number): Promise<boolean> {
        return filtersIdbStorage.has(FiltersStorage.getKey(FiltersStorage.KEY_CHECKSUM, filterId));
    }

    /**
     * Returns specified filter list from cache or {@link filtersIdbStorage}.
     *
     * @param filterId Filter id.
     *
     * @returns Promise, resolved with filter rules strings.
     *
     * @throws Error, if DB operation failed or returned data is not valid.
     */
    static async get(filterId: number): Promise<PreprocessedFilterListWithChecksum | undefined> {
        try {
            const data = await Promise.all([
                FiltersStorage.getFilterList(filterId),
                FiltersStorage.getRawFilterList(filterId),
                FiltersStorage.getConversionMap(filterId),
                FiltersStorage.getSourceMap(filterId),
                FiltersStorage.getChecksum(filterId),
            ]);

            // eslint-disable-next-line prefer-const
            let [filterList, rawFilterList, conversionMap, sourceMap, checksum] = data;

            // If any of the data is missing, return undefined
            if (filterList === undefined || rawFilterList === undefined || checksum === undefined) {
                return undefined;
            }

            // If conversionMap or sourceMap is missing, set it to empty object
            if (conversionMap === undefined) {
                conversionMap = {};
            }

            if (sourceMap === undefined) {
                sourceMap = {};
            }

            return {
                filterList,
                rawFilterList,
                conversionMap,
                sourceMap,
                checksum,
            };
        } catch (e) {
            logger.error(`Failed to get filter data for filter id ${filterId}, got error:`, e);
            throw e;
        }
    }

    /**
     * Removes multiple filter lists from {@link filtersIdbStorage} in batch.
     *
     * @param filterIds Filter ids.
     *
     * @throws Error, if transaction failed.
     */
    public static async removeMultiple(filterIds: number[]): Promise<void> {
        const keys = filterIds.map((filterId) => {
            return [
                FiltersStorage.getKey(FiltersStorage.KEY_FILTER_LIST, filterId),
                FiltersStorage.getKey(FiltersStorage.KEY_RAW_FILTER_LIST, filterId),
                FiltersStorage.getKey(FiltersStorage.KEY_CONVERSION_MAP, filterId),
                FiltersStorage.getKey(FiltersStorage.KEY_SOURCE_MAP, filterId),
                FiltersStorage.getKey(FiltersStorage.KEY_CHECKSUM, filterId),
            ];
        }).flat();

        try {
            const succeeded = await filtersIdbStorage.removeMultiple(keys);
            if (!succeeded) {
                throw new Error('Transaction failed');
            }
        } catch (e) {
            logger.error('Failed to remove multiple filter data, got error:', e);
            throw e;
        }
    }

    /**
     * Gets the raw filter list for the specified filter ID.
     *
     * @param filterId Filter id.
     *
     * @returns Raw filter list or `undefined` if the filter list does not exist.
     */
    public static async getRawFilterList(
        filterId: number,
    ): Promise<PreprocessedFilterList[typeof FiltersStorage.KEY_RAW_FILTER_LIST] | undefined> {
        return filtersIdbStorage.get(
            FiltersStorage.getKey(FiltersStorage.KEY_RAW_FILTER_LIST, filterId),
        ) as Promise<PreprocessedFilterList[typeof FiltersStorage.KEY_RAW_FILTER_LIST] | undefined>;
    }

    /**
     * Gets the byte array of the filter list for the specified filter ID.
     *
     * @param filterId Filter id.
     *
     * @returns Byte array of the filter list or `undefined` if the filter list does not exist.
     */
    public static async getFilterList(
        filterId: number,
    ): Promise<PreprocessedFilterList[typeof FiltersStorage.KEY_FILTER_LIST] | undefined> {
        return filtersIdbStorage.get(
            FiltersStorage.getKey(FiltersStorage.KEY_FILTER_LIST, filterId),
        ) as Promise<PreprocessedFilterList[typeof FiltersStorage.KEY_FILTER_LIST] | undefined>;
    }

    /**
     * Gets the conversion map for the specified filter ID.
     *
     * @param filterId Filter id.
     *
     * @returns Conversion map or `undefined` if the filter list does not exist.
     */
    public static async getConversionMap(
        filterId: number,
    ): Promise<PreprocessedFilterList[typeof FiltersStorage.KEY_CONVERSION_MAP] | undefined> {
        return filtersIdbStorage.get(
            FiltersStorage.getKey(FiltersStorage.KEY_CONVERSION_MAP, filterId),
        ) as Promise<PreprocessedFilterList[typeof FiltersStorage.KEY_CONVERSION_MAP] | undefined>;
    }

    /**
     * Gets the source map for the specified filter ID.
     *
     * @param filterId Filter id.
     *
     * @returns Source map or `undefined` if the filter list does not exist.
     */
    public static async getSourceMap(
        filterId: number,
    ): Promise<PreprocessedFilterList[typeof FiltersStorage.KEY_SOURCE_MAP] | undefined> {
        return filtersIdbStorage.get(
            FiltersStorage.getKey(FiltersStorage.KEY_SOURCE_MAP, filterId),
        ) as Promise<PreprocessedFilterList[typeof FiltersStorage.KEY_SOURCE_MAP] | undefined>;
    }

    /**
     * Gets the checksum for the specified filter ID.
     *
     * @param filterId Filter id.
     *
     * @returns Promise, resolved with checksum or undefined if not found.
     */
    public static async getChecksum(filterId: number): Promise<string | undefined> {
        return filtersIdbStorage.get(
            FiltersStorage.getKey(FiltersStorage.KEY_CHECKSUM, filterId),
        ) as Promise<string | undefined>;
    }

    /**
     * Returns all filter IDs from {@link filtersIdbStorage}.
     *
     * @returns Promise, resolved with filter ids.
     *
     * @throws Error, if DB operation failed.
     */
    public static async getFilterIds(): Promise<number[]> {
        try {
            const keys = await filtersIdbStorage.keys();
            return keys
                .filter((key) => key.startsWith(FiltersStorage.KEY_CHECKSUM))
                .map((key) => parseInt(key.split(FiltersStorage.KEY_COMBINER)[1], 10));
        } catch (e) {
            logger.error('Failed to get filter ids, got error:', e);
            throw e;
        }
    }
}
