import { type PreprocessedFilterList } from '@adguard/tsurlfilter';
import { type IDBPDatabase, openDB } from 'idb';

import { logger } from '../utils/logger';

/**
 * Preprocessed filter list extended with checksum.
 */
export type PreprocessedFilterListWithChecksum = PreprocessedFilterList & { checksum: string };

/**
 * Provides a "synchronized storage" for filter lists.
 * This storage is needed to synchronize data from JSON rulesets to IndexedDB
 * on every extension start (if needed).
 */
export class FiltersStorage {
    /**
     * Database name.
     */
    private static readonly DB_NAME = 'tswebextensionIDB';

    /**
     * Database store name.
     */
    private static readonly DB_STORE_NAME = 'filters';

    /**
     * Database version.
     * If you need to change the database structure, you should increase this version,
     * and it will result in the deletion of the old database when the extension starts next time.
     */
    private static readonly DB_VERSION = 1;

    /**
     * Key combiner.
     */
    private static readonly KEY_COMBINER = '_';

    /**
     * Key prefix for byte serialized filter list.
     */
    private static readonly KEY_FILTER_LIST = 'filterList';

    /**
     * Key prefix for raw filter list.
     */
    private static readonly KEY_RAW_FILTER_LIST = 'rawFilterList';

    /**
     * Key prefix for conversion map.
     */
    private static readonly KEY_CONVERSION_MAP = 'conversionMap';

    /**
     * Key prefix for source map.
     */
    private static readonly KEY_SOURCE_MAP = 'sourceMap';

    /**
     * Key prefix for checksum.
     */
    private static readonly KEY_CHECKSUM = 'checksum';

    /**
     * Opened IndexedDB database.
     */
    private static db: IDBPDatabase | null = null;

    /**
     * Promise to get IndexedDB database.
     */
    private static dbGetterPromise: Promise<IDBPDatabase> | null = null;

    /**
     * Helper method to check if the value is a number.
     *
     * @param value Value to check.
     *
     * @returns `true` if the value is a number, `false` otherwise.
     */
    private static isNumber(value: unknown): value is number {
        return typeof value === 'number' && !Number.isNaN(value);
    }

    /**
     * Returns opened database.
     *
     * @returns Promise, resolved with opened database.
     */
    private static async getOpenedDb(): Promise<IDBPDatabase> {
        if (FiltersStorage.db) {
            return FiltersStorage.db;
        }

        if (FiltersStorage.dbGetterPromise) {
            return FiltersStorage.dbGetterPromise;
        }

        FiltersStorage.dbGetterPromise = (async (): Promise<IDBPDatabase> => {
            FiltersStorage.db = await openDB(
                FiltersStorage.DB_NAME,
                FiltersStorage.DB_VERSION,
                {
                    upgrade(db, oldVersion, newVersion) {
                        const hasStore = db.objectStoreNames.contains(FiltersStorage.DB_STORE_NAME);

                        if (!hasStore) {
                            db.createObjectStore(FiltersStorage.DB_STORE_NAME);
                        } else if (FiltersStorage.isNumber(newVersion) && oldVersion < newVersion) {
                            db.deleteObjectStore(FiltersStorage.DB_STORE_NAME);
                            db.createObjectStore(FiltersStorage.DB_STORE_NAME);
                        }
                    },
                },
            );

            FiltersStorage.dbGetterPromise = null;

            return FiltersStorage.db;
        })();

        return FiltersStorage.dbGetterPromise;
    }

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

        const db = await FiltersStorage.getOpenedDb();
        const tx = db.transaction(FiltersStorage.DB_STORE_NAME, 'readwrite');

        try {
            for (const [key, value] of Object.entries(data)) {
                tx.store.put(value, key);
            }

            await tx.done;
        } catch (e) {
            logger.error('Failed to set multiple filter data, got error:', e);
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
        const db = await FiltersStorage.getOpenedDb();
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

        const db = await FiltersStorage.getOpenedDb();
        const tx = db.transaction(FiltersStorage.DB_STORE_NAME, 'readwrite');

        try {
            await Promise.all(keys.map((key) => tx.store.delete(key)));
            await tx.done;
        } catch (e) {
            logger.error('Failed to remove multiple filter data, got error:', e);
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
    ): Promise<PreprocessedFilterList[typeof FiltersStorage.KEY_RAW_FILTER_LIST] | undefined> {
        const db = await FiltersStorage.getOpenedDb();
        return db.get(
            FiltersStorage.DB_STORE_NAME,
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
        const db = await FiltersStorage.getOpenedDb();
        return db.get(
            FiltersStorage.DB_STORE_NAME,
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
        const db = await FiltersStorage.getOpenedDb();
        return db.get(
            FiltersStorage.DB_STORE_NAME,
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
        const db = await FiltersStorage.getOpenedDb();
        return db.get(
            FiltersStorage.DB_STORE_NAME,
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
        const db = await FiltersStorage.getOpenedDb();
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
            const db = await FiltersStorage.getOpenedDb();
            const keys = await db.getAllKeys(FiltersStorage.DB_STORE_NAME);
            return keys
                .map(String)
                .filter((key) => key.startsWith(FiltersStorage.KEY_CHECKSUM))
                .map((key) => parseInt(key.split(FiltersStorage.KEY_COMBINER)[1], 10));
        } catch (e) {
            logger.error('Failed to get filter ids, got error:', e);
            throw e;
        }
    }
}
