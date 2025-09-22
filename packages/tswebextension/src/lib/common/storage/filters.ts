import { type ConversionData } from '@adguard/tsurlfilter';

import { logger } from '../utils/logger';
import { IdbSingleton } from '../idb-singleton';

/**
 * Preprocessed filter list extended with checksum.
 */
export type ConvertedFilterListWithChecksum = {
    /**
     * Checksum.
     */
    checksum: string;

    /**
     * Raw filter list converted to AdGuard syntax.
     */
    rawFilterList: string;

    /**
     * Conversion data.
     */
    conversionData: ConversionData;
};

/**
 * Provides a "synchronized storage" for filter lists.
 * This storage is needed to synchronize data from JSON rulesets to IndexedDB
 * on every extension start (if needed).
 */
export class FiltersStorage {
    /**
     * Database store name.
     */
    private static readonly DB_STORE_NAME = 'filters';

    /**
     * Key combiner.
     */
    private static readonly KEY_COMBINER = '_';

    /**
     * Key prefix for raw filter list.
     */
    private static readonly KEY_RAW_FILTER_LIST = 'rawFilterList';

    /**
     * Key prefix for conversion data.
     */
    private static readonly KEY_CONVERSION_DATA = 'conversionData';

    /**
     * Key prefix for checksum.
     */
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
    public static async setMultiple(filters: Record<number, ConvertedFilterListWithChecksum>): Promise<void> {
        const data: Record<string, unknown> = {};

        for (const [filterId, filter] of Object.entries(filters)) {
            for (const [key, value] of Object.entries(filter)) {
                data[FiltersStorage.getKey(key, filterId)] = value;
            }
        }

        const db = await IdbSingleton.getOpenedDb(FiltersStorage.DB_STORE_NAME);
        const tx = db.transaction(FiltersStorage.DB_STORE_NAME, 'readwrite');

        try {
            for (const [key, value] of Object.entries(data)) {
                tx.store.put(value, key);
            }

            await tx.done;
        } catch (e) {
            logger.error('[tsweb.FiltersStorage.setMultiple]: failed to set multiple filter data, got error: ', e);
            tx.abort();
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
        const db = await IdbSingleton.getOpenedDb(FiltersStorage.DB_STORE_NAME);
        const keys = await db.getAllKeys(FiltersStorage.DB_STORE_NAME);
        const searchedKey = FiltersStorage.getKey(FiltersStorage.KEY_CHECKSUM, filterId);
        return keys
            .map(String)
            .some((key) => key === searchedKey);
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
    static async get(filterId: number): Promise<ConvertedFilterListWithChecksum | undefined> {
        try {
            const data = await Promise.all([
                FiltersStorage.getRawFilterList(filterId),
                FiltersStorage.getConversionData(filterId),
                FiltersStorage.getChecksum(filterId),
            ]);

            // eslint-disable-next-line prefer-const
            let [rawFilterList, conversionData, checksum] = data;

            // If any of the data is missing, return undefined
            if (rawFilterList === undefined || checksum === undefined) {
                return undefined;
            }

            // If conversionData is missing, set it to empty object
            if (conversionData === undefined) {
                conversionData = {
                    originals: [],
                    conversions: [],
                };
            }

            return {
                rawFilterList,
                conversionData,
                checksum,
            };
        } catch (e) {
            logger.error(`[tsweb.FiltersStorage.get]: failed to get filter data for filter id ${filterId}, got error:`, e);
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
                FiltersStorage.getKey(FiltersStorage.KEY_RAW_FILTER_LIST, filterId),
                FiltersStorage.getKey(FiltersStorage.KEY_CONVERSION_DATA, filterId),
                FiltersStorage.getKey(FiltersStorage.KEY_CHECKSUM, filterId),
            ];
        }).flat();

        const db = await IdbSingleton.getOpenedDb(FiltersStorage.DB_STORE_NAME);
        const tx = db.transaction(FiltersStorage.DB_STORE_NAME, 'readwrite');

        try {
            await Promise.all(keys.map((key) => tx.store.delete(key)));
            await tx.done;
        } catch (e) {
            logger.error('[tsweb.FiltersStorage.removeMultiple]: failed to remove multiple filter data, got error: ', e);
            tx.abort();
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
    ): Promise<string | undefined> {
        const db = await IdbSingleton.getOpenedDb(FiltersStorage.DB_STORE_NAME);
        return db.get(
            FiltersStorage.DB_STORE_NAME,
            FiltersStorage.getKey(FiltersStorage.KEY_RAW_FILTER_LIST, filterId),
        ) as Promise<string | undefined>;
    }

    /**
     * Gets the conversion map for the specified filter ID.
     *
     * @param filterId Filter id.
     *
     * @returns Conversion map or `undefined` if the filter list does not exist.
     */
    public static async getConversionData(
        filterId: number,
    ): Promise<ConversionData | undefined> {
        const db = await IdbSingleton.getOpenedDb(FiltersStorage.DB_STORE_NAME);
        return db.get(
            FiltersStorage.DB_STORE_NAME,
            FiltersStorage.getKey(FiltersStorage.KEY_CONVERSION_DATA, filterId),
        ) as Promise<ConversionData | undefined>;
    }

    /**
     * Gets the checksum for the specified filter ID.
     *
     * @param filterId Filter id.
     *
     * @returns Promise, resolved with checksum or undefined if not found.
     */
    public static async getChecksum(filterId: number): Promise<string | undefined> {
        const db = await IdbSingleton.getOpenedDb(FiltersStorage.DB_STORE_NAME);
        return db.get(
            FiltersStorage.DB_STORE_NAME,
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
            const db = await IdbSingleton.getOpenedDb(FiltersStorage.DB_STORE_NAME);
            const keys = await db.getAllKeys(FiltersStorage.DB_STORE_NAME);
            return keys
                .map(String)
                .filter((key) => key.startsWith(FiltersStorage.KEY_CHECKSUM))
                .map((key) => parseInt(key.split(FiltersStorage.KEY_COMBINER)[1], 10));
        } catch (e) {
            logger.error('[tsweb.FiltersStorage.getFilterIds]: failed to get filter ids, got error: ', e);
            throw e;
        }
    }
}
