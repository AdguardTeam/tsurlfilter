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
     * Global upgrade lock to ensure all database operations wait for upgrades to complete.
     */
    private static upgradePromise: Promise<IDBPDatabase> | null = null;

    /**
     * Returns an opened database containing the requested store. The method
     * upgrades the database when the requested store is missing, preserving
     * existing data in other stores.
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
        // Wait for any pending operations to complete first (single await for atomicity)
        if (IdbSingleton.upgradePromise || IdbSingleton.dbGetterPromise) {
            const locks = [
                IdbSingleton.upgradePromise,
                IdbSingleton.dbGetterPromise,
            ].filter((lock) => lock !== null);

            await Promise.all(locks);
        }

        // Fast path when we already have an open DB containing the store.
        if (IdbSingleton.db?.objectStoreNames.contains(store)) {
            return IdbSingleton.db;
        }

        // If no operation is in progress, start a new one
        if (!IdbSingleton.dbGetterPromise) {
            IdbSingleton.dbGetterPromise = IdbSingleton.openDatabase(store, onUpgrade);
        }

        return IdbSingleton.dbGetterPromise;
    }

    /**
     * Opens the database and ensures the required store exists.
     *
     * @param store Name of the object store that must be present.
     * @param onUpgrade Optional callback to be called when the database is upgraded.
     *
     * @returns Promise resolved with opened database.
     */
    private static async openDatabase(
        store: string,
        onUpgrade?: (oldVersion: number, newVersion: number | null) => void,
    ): Promise<IDBPDatabase> {
        try {
            if (IdbSingleton.db) {
                IdbSingleton.db.close();
                IdbSingleton.db = null;
            }

            // Probe: open with undefined version, which opens the current version.
            let db = await openDB(IdbSingleton.DB_NAME, undefined, {
                upgrade(_database, oldVersion, newVersion) {
                    logger.debug('[tsweb.IdbSingleton.openDatabase]: Upgrade IDB version from', oldVersion, 'to', newVersion);
                },
                blocked() {
                    logger.warn('[tsweb.IdbSingleton.openDatabase]: IDB upgrade blocked');
                },
            });

            // Check if we need to upgrade for missing store
            if (!db.objectStoreNames.contains(store)) {
                db = await IdbSingleton.upgradeDatabase(db, store, onUpgrade);
            }

            IdbSingleton.db = db;
            return db;
        } finally {
            IdbSingleton.dbGetterPromise = null;
        }
    }

    /**
     * Upgrades the database to create a missing store.
     * Preserves existing data in all other stores.
     *
     * @param currentDb Current database instance to upgrade.
     * @param store Name of the store to create.
     * @param onUpgrade Optional callback to be called when the database is upgraded.
     *
     * @returns Promise resolved with upgraded database.
     */
    private static async upgradeDatabase(
        currentDb: IDBPDatabase,
        store: string,
        onUpgrade?: (oldVersion: number, newVersion: number | null) => void,
    ): Promise<IDBPDatabase> {
        // If an upgrade is already in progress, wait for it
        if (IdbSingleton.upgradePromise) {
            await IdbSingleton.upgradePromise;
            // After waiting, check if our store was created by the other upgrade
            if (IdbSingleton.db?.objectStoreNames.contains(store)) {
                return IdbSingleton.db;
            }
        }

        const currentVersion = currentDb.version;
        const newVersion = currentVersion + 1;

        // Close the database before upgrading
        currentDb.close();

        // Create upgrade promise to block other operations
        const upgradeTask = async (): Promise<IDBPDatabase> => {
            try {
                // Call upgrade callback before database upgrade
                onUpgrade?.(currentVersion, newVersion);

                // Upgrade: bump version by +1, add missing store
                const upgradedDb = await openDB(IdbSingleton.DB_NAME, newVersion, {
                    upgrade(database, oldVersion, upgradeNewVersion) {
                        logger.debug('[tsweb.IdbSingleton.upgradeDatabase]: Upgrade IDB version from', oldVersion, 'to', upgradeNewVersion);
                        // Create the missing store without affecting existing stores
                        if (!database.objectStoreNames.contains(store)) {
                            database.createObjectStore(store);
                        }
                    },
                    blocked() {
                        logger.warn('[tsweb.IdbSingleton.upgradeDatabase]: IDB upgrade blocked');
                    },
                });
                return upgradedDb;
            } finally {
                IdbSingleton.upgradePromise = null;
            }
        };

        IdbSingleton.upgradePromise = upgradeTask();
        return upgradeTask();
    }
}
