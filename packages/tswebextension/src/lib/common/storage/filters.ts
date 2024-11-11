import { z } from 'zod';
import { type PreprocessedFilterList, preprocessedFilterListValidator } from '@adguard/tsurlfilter';
import { logger } from '../utils/logger';
import { IDBStorage } from './core/idb-storage';

/**
 * The name of the IndexedDB database for AdGuard API.
 */
const ADGUARD_API_IDB_NAME = 'tswebextensionIDB';

/**
 * The name of the filters database within the AdGuard API IndexedDB.
 */
const ADGUARD_API_FILTERS_DB_NAME = 'filters';

/**
 * An instance of IDBStorage for storing filter data.
 */
export const filtersIdbStorage = new IDBStorage(
    ADGUARD_API_FILTERS_DB_NAME,
    IDBStorage.DEFAULT_IDB_VERSION,
    ADGUARD_API_IDB_NAME,
);

/**
 * Provides a storage for filter lists.
 * It is built on top of {@link filtersIdbStorage}.
 */
export class FiltersStorage {
    private static readonly FILTER_KEY = 'filter';

    private static readonly CHECKSUM_KEY = 'checksum';

    /**
     * Returns key with prefix.
     *
     * @param filterId Filter id.
     * @param key Key.
     *
     * @returns Key with prefix.
     */
    private static getKey(filterId: number | string, key: string): string {
        return `${key}_${filterId}`;
    }

    /**
     * Sets multiple filter lists to {@link filtersIdbStorage} in batch.
     *
     * @param filters Record with filter id as a key and filter rules strings as a value.
     *
     * @throws Error, if transaction failed.
     */
    public static async setMultipleFilters(filters: Record<number, PreprocessedFilterList>): Promise<void> {
        const data: Record<string, PreprocessedFilterList> = {};

        for (const [filterId, filter] of Object.entries(filters)) {
            data[FiltersStorage.getKey(filterId, FiltersStorage.FILTER_KEY)] = filter;
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
     * Removes multiple filter lists from {@link filtersIdbStorage} in batch.
     *
     * @param filterIds Filter ids.
     *
     * @throws Error, if transaction failed.
     */
    public static async removeMultipleFilters(filterIds: number[]): Promise<void> {
        const keys = filterIds.map((filterId) => FiltersStorage.getKey(filterId, FiltersStorage.FILTER_KEY));

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
     * Returns all filter ids from {@link filtersIdbStorage}.
     *
     * @returns Promise, resolved with filter ids.
     *
     * @throws Error, if DB operation failed.
     */
    public static async getFilterIds(): Promise<number[]> {
        try {
            const keys = await filtersIdbStorage.keys();
            return keys
                .filter((key) => key.startsWith(FiltersStorage.FILTER_KEY))
                .map((key) => parseInt(key.split('_')[1], 10));
        } catch (e) {
            logger.error('Failed to get filter ids, got error:', e);
            throw e;
        }
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
    static async getFilter(filterId: number): Promise<PreprocessedFilterList | null> {
        try {
            const filter = await filtersIdbStorage.get(FiltersStorage.getKey(filterId, FiltersStorage.FILTER_KEY));

            if (!filter) {
                return null;
            }

            return preprocessedFilterListValidator.parse(filter);
        } catch (e) {
            logger.error(`Failed to get filter data for filter id ${filterId}, got error:`, e);
            throw e;
        }
    }

    /**
     * Sets multiple filter checksums to {@link filtersIdbStorage} in batch.
     *
     * @param checksums Record with filter id as a key and checksum as a value.
     *
     * @throws Error, if transaction failed.
     */
    static async setMultipleChecksums(checksums: Record<number, string>): Promise<void> {
        const data: Record<string, string> = {};

        for (const [filterId, checksum] of Object.entries(checksums)) {
            data[FiltersStorage.getKey(filterId, FiltersStorage.CHECKSUM_KEY)] = checksum;
        }

        try {
            const succeeded = await filtersIdbStorage.setMultiple(data);
            if (!succeeded) {
                throw new Error('Transaction failed');
            }
        } catch (e) {
            logger.error('Failed to set multiple filter checksums, got error:', e);
            throw e;
        }
    }

    /**
     * Removes multiple filter checksums from {@link filtersIdbStorage} in batch.
     *
     * @param filterIds Filter ids.
     *
     * @throws Error, if transaction failed.
     */
    static async removeMultipleChecksums(filterIds: number[]): Promise<void> {
        const keys = filterIds.map((filterId) => FiltersStorage.getKey(filterId, FiltersStorage.CHECKSUM_KEY));

        try {
            const succeeded = await filtersIdbStorage.removeMultiple(keys);
            if (!succeeded) {
                throw new Error('Transaction failed');
            }
        } catch (e) {
            logger.error('Failed to remove multiple filter checksums, got error:', e);
            throw e;
        }
    }

    /**
     * Returns specified filter checksum from cache or {@link filtersIdbStorage}.
     *
     * @param filterId Filter id.
     *
     * @returns Promise, resolved with checksum.
     *
     * @throws Error, if DB operation failed or returned data is not valid.
     */
    static async getChecksum(filterId: number): Promise<string | null> {
        try {
            const checksum = await filtersIdbStorage.get(FiltersStorage.getKey(filterId, FiltersStorage.CHECKSUM_KEY));

            if (!checksum) {
                return null;
            }

            return z.string().parse(checksum);
        } catch (e) {
            logger.error(`Failed to get filter checksum for filter id ${filterId}, got error:`, e);
            throw e;
        }
    }
}
