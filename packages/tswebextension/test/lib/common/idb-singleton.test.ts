import {
    describe,
    it,
    expect,
    beforeEach,
    vi,
} from 'vitest';
import * as idb from 'idb';

import { logger } from '../../../src/lib/common/utils/logger';
import { IdbSingleton } from '../../../src/lib/common/idb-singleton';

vi.mock('idb', { spy: true });

// Helpers to poke the private static fields.
// (TS “private” is only a compile-time check, so a cast works fine.)
const priv = IdbSingleton as unknown as {
    db: idb.IDBPDatabase | null;
    dbGetterPromise: Promise<idb.IDBPDatabase> | null;
};

describe('IdbSingleton', () => {
    /**
     * Make every test start from a clean slate:
     *   – close the existing connection
     *   – wipe the private static refs
     *   – delete the underlying IndexedDB DB.
     */
    beforeEach(async () => {
        priv.db?.close();
        priv.db = null;
        priv.dbGetterPromise = null;
        indexedDB.deleteDatabase(IdbSingleton.DB_NAME);
    });

    it('creates a database that contains the requested store', async () => {
        const db = await IdbSingleton.getOpenedDb('my-store');
        expect(db.objectStoreNames.contains('my-store')).toBe(true);
    });

    it('returns the *same* DB instance for subsequent calls with the same store', async () => {
        const first = await IdbSingleton.getOpenedDb('cache');
        const openSpy = vi.spyOn(idb, 'openDB');

        const second = await IdbSingleton.getOpenedDb('cache');

        expect(second).toBe(first); // same object reference
        expect(openSpy).not.toHaveBeenCalled();

        openSpy.mockRestore();
    });

    it('only calls openDB once when multiple callers race for the same store', async () => {
        const openSpy = vi.spyOn(idb, 'openDB');

        const [a, b, c] = await Promise.all([
            IdbSingleton.getOpenedDb('race'),
            IdbSingleton.getOpenedDb('race'),
            IdbSingleton.getOpenedDb('race'),
        ]);

        expect(a).toBe(b);
        expect(b).toBe(c);

        // probe open + upgrade open = 2
        expect(openSpy).toHaveBeenCalledTimes(2);

        openSpy.mockRestore();
    });

    it('bumps the version and adds a store when a *new* store is requested', async () => {
        const db1 = await IdbSingleton.getOpenedDb('store1');
        const v1 = db1.version;

        // Close the existing DB connection to allow upgrade
        db1.close();
        priv.db = null;

        const db2 = await IdbSingleton.getOpenedDb('store2');

        expect(db2.version).toBe(v1 + 1);
        expect(db2.objectStoreNames.contains('store2')).toBe(true);
    });

    it('recovers after an opening failure so that the next attempt succeeds', async () => {
        const boom = new Error('opening failed');
        const stub = vi.spyOn(idb, 'openDB').mockRejectedValueOnce(boom);

        vi.spyOn(logger, 'error').mockImplementation(() => {});

        await expect(IdbSingleton.getOpenedDb('flaky'))
            .rejects.toThrow('opening failed');

        stub.mockRestore(); // restore the real implementation

        // Ensure singleton internal state is reset after the failure
        priv.db = null;

        const db = await IdbSingleton.getOpenedDb('flaky');
        expect(db.objectStoreNames.contains('flaky')).toBe(true);
    });
});
