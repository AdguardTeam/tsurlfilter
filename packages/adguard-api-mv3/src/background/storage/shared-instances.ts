import { IDBStorage } from './idb';

const ADGUARD_API_IDB_NAME = 'adguardApiIDB';

const ADGUARD_API_FILTERS_DB_NAME = 'filters';
const ADGUARD_API_VERSIONS_DB_NAME = 'versions';

export const filtersIdbStorage = new IDBStorage(
    ADGUARD_API_FILTERS_DB_NAME,
    IDBStorage.DEFAULT_IDB_VERSION,
    ADGUARD_API_IDB_NAME,
);

export const versionsIdbStorage = new IDBStorage(
    ADGUARD_API_VERSIONS_DB_NAME,
    IDBStorage.DEFAULT_IDB_VERSION,
    ADGUARD_API_IDB_NAME,
);
