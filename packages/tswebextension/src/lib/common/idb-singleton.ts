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
    private static getterPromise: Promise<IDBPDatabase> | null = null;

    /**
     * Global upgrade lock to ensure all database operations wait for upgrades to complete.
     */
    private static upgradePromise: Promise<IDBPDatabase> | null = null;

    /**
     * Returns an opened database containing the requested store. The method
     * upgrades the database when the requested store is missing, preserving
     * all existing data in other stores during upgrade.
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
        if (IdbSingleton.upgradePromise || IdbSingleton.getterPromise) {
            const locks = [
                IdbSingleton.upgradePromise,
                IdbSingleton.getterPromise,
            ].filter((lock) => lock !== null);

            await Promise.all(locks);
        }

        // Fast path when we already have an open DB containing the store.
        if (IdbSingleton.db?.objectStoreNames.contains(store)) {
            return IdbSingleton.db;
        }

        // If no operation is in progress, start a new one
        if (!IdbSingleton.getterPromise) {
            IdbSingleton.getterPromise = IdbSingleton.openDatabase(store, onUpgrade);
        }

        return IdbSingleton.getterPromise;
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

            let db = await openDB(
                IdbSingleton.DB_NAME,
                // Probe: open with undefined version, which opens the current version.
                undefined,
                {
                    upgrade(_database, oldVersion, newVersion) {
                        logger.debug('[tsweb.IdbSingleton.openDatabase]: Upgrade IDB version from', oldVersion, 'to', newVersion);
                    },
                    blocked() {
                    // In normal situation we expected that this will not happen
                    // since we have mutex promise for upgrade.
                        logger.warn('[tsweb.IdbSingleton.openDatabase]: IDB upgrade blocked');
                    },
                },
            );

            // Check if we need to upgrade for missing store
            if (!db.objectStoreNames.contains(store)) {
                db = await IdbSingleton.upgradeDatabase(db, store, onUpgrade);
            }

            IdbSingleton.db = db;

            return db;
        } finally {
            IdbSingleton.getterPromise = null;
        }
    }

    /**
     * Upgrades the database to create a missing store.
     * Preserves all existing data in other stores during upgrade.
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
            const upgradedDb = await IdbSingleton.upgradePromise;

            // Update currentDb reference to the result of the previous upgrade
            if (!upgradedDb) {
                throw new Error('Previous upgrade returned null database');
            }

            // After waiting, check if our store was created by the other upgrade.
            // Otherwise, if the store still doesn't exist, we need to do our own upgrade
            if (upgradedDb?.objectStoreNames.contains(store)) {
                return upgradedDb;
            }

            currentDb = upgradedDb;
        }

        const currentVersion = currentDb.version;
        // Upgrade: bump version by +1, add missing store
        const newVersion = currentVersion + 1;

        // Close the database before upgrading
        currentDb.close();

        // Create upgrade promise to block other operations
        try {
            const upgradeTask = IdbSingleton.executeUpgradeTask(currentVersion, newVersion, store, onUpgrade);

            IdbSingleton.upgradePromise = upgradeTask;

            return await upgradeTask;
        } catch (error) {
            logger.error('[tsweb.IdbSingleton.upgradeDatabase]: Failed to upgrade database:', error);
            throw error;
        } finally {
            IdbSingleton.upgradePromise = null;
        }
    }

    /**
     * Executes the database upgrade task.
     *
     * @param currentVersion Current database version.
     * @param newVersion New database version.
     * @param store Name of the store to create.
     * @param onUpgrade Optional callback to be called when the database is upgraded.
     *
     * @returns Promise resolved with upgraded database.
     */
    private static async executeUpgradeTask(
        currentVersion: number,
        newVersion: number,
        store: string,
        onUpgrade?: (oldVersion: number, newVersion: number | null) => void,
    ): Promise<IDBPDatabase> {
        return openDB(
            IdbSingleton.DB_NAME,
            newVersion,
            {
                upgrade(database, oldVersion, upgradeNewVersion) {
                    logger.debug('[tsweb.IdbSingleton.executeUpgradeTask]: Upgrade IDB version from', oldVersion, 'to', upgradeNewVersion);

                    // Create the missing store without affecting existing stores
                    if (!database.objectStoreNames.contains(store)) {
                        database.createObjectStore(store);
                    }

                    // Call upgrade callback after database upgrade.
                    if (onUpgrade) {
                        onUpgrade(currentVersion, newVersion);
                    }
                },
                blocked() {
                    // In normal situation we expected that this will not happen
                    // since we have mutex promise for upgrade.
                    logger.warn('[tsweb.IdbSingleton.executeUpgradeTask]: IDB upgrade blocked - another upgrade in progress');
                },
            },
        );
    }

    /**
     * Drops all data by deleting and recreating the database.
     * This method closes any existing connections and completely removes the database.
     *
     * @returns Promise that resolves when the database is successfully deleted.
     */
    public static async dropAllData(): Promise<void> {
        try {
            // Close existing database connection if open
            if (IdbSingleton.db) {
                IdbSingleton.db.close();
                IdbSingleton.db = null;
            }

            // Reset all promises to ensure clean state
            IdbSingleton.getterPromise = null;
            IdbSingleton.upgradePromise = null;

            // Delete the entire database
            await new Promise<void>((resolve, reject) => {
                const deleteRequest = indexedDB.deleteDatabase(IdbSingleton.DB_NAME);

                deleteRequest.onsuccess = (): void => {
                    logger.debug('[tsweb.IdbSingleton.dropAllData]: Successfully deleted database:', IdbSingleton.DB_NAME);
                    resolve();
                };

                deleteRequest.onerror = (): void => {
                    logger.error('[tsweb.IdbSingleton.dropAllData]: Failed to delete database:', IdbSingleton.DB_NAME, deleteRequest.error);
                    reject(deleteRequest.error);
                };

                deleteRequest.onblocked = (): void => {
                    logger.warn('[tsweb.IdbSingleton.dropAllData]: Database deletion blocked for:', IdbSingleton.DB_NAME);
                };
            });

            logger.info('[tsweb.IdbSingleton.dropAllData]: Successfully dropped all data from IndexedDB');
        } catch (e) {
            logger.error('[tsweb.IdbSingleton.dropAllData]: Failed to drop all data:', e);
            throw e;
        }
    }
}
