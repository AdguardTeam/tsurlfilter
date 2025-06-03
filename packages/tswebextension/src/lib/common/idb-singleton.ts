import { openDB, type IDBPDatabase } from 'idb';

import { logger } from './utils/logger';

/**
 * Singleton class for managing IndexedDB database.
 */
export class IdbSingleton {
    /**
     * Database name.
     */
    public static readonly DB_NAME = 'tswebextensionIDB';

    /**
     * Active database connection (null when closed).
     */
    private static db: IDBPDatabase | null = null;

    /**
     * In‑flight promise used as a mutex to avoid races.
     */
    private static dbGetterPromise: Promise<IDBPDatabase> | null = null;

    /**
     * Returns an opened database containing the requested store. The method
     * upgrades the database (and clears all existing stores) when the requested
     * store is missing.
     *
     * @param store Name of the object store that must be present.
     * @param onUpgrade Optional callback to be called when the database is upgraded.
     *
     * @returns Promise, resolved with opened database.
     */
    public static async getOpenedDb(
        store: string,
        onUpgrade?: (oldVersion: number, newVersion: number | null) => void,
    ): Promise<IDBPDatabase> {
        // Fast path when we already have an open DB containing the store.
        if (IdbSingleton.db?.objectStoreNames.contains(store)) {
            return IdbSingleton.db;
        }

        // If someone is already opening/upgrading, just wait for them.
        if (IdbSingleton.dbGetterPromise) {
            return IdbSingleton.dbGetterPromise;
        }

        IdbSingleton.dbGetterPromise = (async (): Promise<IDBPDatabase> => {
            try {
                if (IdbSingleton.db) {
                    IdbSingleton.db.close();
                    IdbSingleton.db = null;
                }

                // Probe: open with undefined version, which opens the current version.
                let db = await openDB(IdbSingleton.DB_NAME, undefined, {
                    upgrade(_database, oldVersion, newVersion) {
                        logger.debug('[tsweb.IdbSingleton.getOpenedDb]: Upgrade IDB version from', oldVersion, 'to', newVersion);
                    },
                    blocked() {
                        logger.warn('[tsweb.IdbSingleton.getOpenedDb]: IDB upgrade blocked');
                    },
                });

                if (!db.objectStoreNames.contains(store)) {
                    const currentVersion = db.version;
                    // Close the database before upgrading.
                    db.close();
                    // Upgrade: bump version by +1, clear stores, add missing store
                    db = await openDB(IdbSingleton.DB_NAME, currentVersion + 1, {
                        upgrade(database, oldVersion, newVersion, tx) {
                            onUpgrade?.(oldVersion, newVersion);
                            logger.debug('[tsweb.IdbSingleton.getOpenedDb]: Upgrade IDB version from', oldVersion, 'to', newVersion);
                            for (const name of Array.from(database.objectStoreNames)) {
                                tx.objectStore(name).clear();
                            }
                            if (!database.objectStoreNames.contains(store)) {
                                database.createObjectStore(store);
                            }
                        },
                        blocked() {
                            logger.warn('[tsweb.IdbSingleton.getOpenedDb]: IDB upgrade blocked');
                        },
                    });
                }

                IdbSingleton.db = db;
                return db;
            } finally {
                IdbSingleton.dbGetterPromise = null;
            }
        })();

        return IdbSingleton.dbGetterPromise;
    }
}
