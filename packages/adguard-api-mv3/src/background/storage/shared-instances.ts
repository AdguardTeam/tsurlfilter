import { IDBStorage } from './idb';

/**
 * The name of the IndexedDB database for AdGuard API.
 */
const ADGUARD_API_IDB_NAME = 'adguardApiIDB';

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
