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
 * The name of the versions database within the AdGuard API IndexedDB.
 */
const ADGUARD_API_VERSIONS_DB_NAME = 'versions';

/**
 * An instance of IDBStorage for storing filter data.
 */
export const filtersIdbStorage = new IDBStorage(
    ADGUARD_API_FILTERS_DB_NAME,
    IDBStorage.DEFAULT_IDB_VERSION,
    ADGUARD_API_IDB_NAME,
);

/**
 * An instance of IDBStorage for storing version data.
 */
export const versionsIdbStorage = new IDBStorage(
    ADGUARD_API_VERSIONS_DB_NAME,
    IDBStorage.DEFAULT_IDB_VERSION,
    ADGUARD_API_IDB_NAME,
);
