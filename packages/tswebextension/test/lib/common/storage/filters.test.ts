import {
    describe,
    expect,
    it,
    vi,
} from 'vitest';
import * as idb from 'idb';
import { FilterListPreprocessor } from '@adguard/tsurlfilter';

import { FiltersStorage } from '../../../../src/lib/common/storage/filters';

vi.mock('idb', { spy: true });

describe('FiltersStorage', () => {
    it('deletes content if the db version increases', async () => {
        // Initial DB version setup
        const dbVersionDescriptor = Object.getOwnPropertyDescriptor(FiltersStorage, 'DB_VERSION');
        Object.defineProperty(FiltersStorage, 'DB_VERSION', { ...dbVersionDescriptor, value: 1 });

        // Insert data into storage
        const preprocessed = FilterListPreprocessor.preprocess('@@||example.com^$document');
        await FiltersStorage.setMultiple({
            1: {
                ...preprocessed,
                checksum: 'foo',
            },
        });

        // Check that the data is correctly stored
        await expect(FiltersStorage.get(1)).resolves.not.toBeUndefined();

        // Simulate DB closure and reopen (clearing connection)
        let dbDescriptor = Object.getOwnPropertyDescriptor(FiltersStorage, 'db');
        dbDescriptor?.value.close();
        Object.defineProperty(FiltersStorage, 'db', { ...dbDescriptor, value: null }); // Clear DB

        // Reopen the DB and check that the data is still present
        await expect(FiltersStorage.get(1)).resolves.not.toBeUndefined();

        // Close the DB connection again
        dbDescriptor = Object.getOwnPropertyDescriptor(FiltersStorage, 'db');
        dbDescriptor?.value.close();
        Object.defineProperty(FiltersStorage, 'db', { ...dbDescriptor, value: null });

        // Increase DB version
        Object.defineProperty(FiltersStorage, 'DB_VERSION', { value: 2 });

        // Data should be deleted since the version has increased
        await expect(FiltersStorage.get(1)).resolves.toBeUndefined();
    });

    it('initializer promise prevents trying to open the DB multiple times', async () => {
        // Insert data into storage
        const preprocessed = FilterListPreprocessor.preprocess('@@||example.com^$document');
        await FiltersStorage.setMultiple({
            1: {
                ...preprocessed,
                checksum: 'foo',
            },
        });

        // Imitate the DB being closed
        const dbDescriptor = Object.getOwnPropertyDescriptor(FiltersStorage, 'db');
        dbDescriptor?.value.close();
        Object.defineProperty(FiltersStorage, 'db', { ...dbDescriptor, value: null });

        const getOpenedDbSpy = vi.spyOn(FiltersStorage, 'getOpenedDb' as any);
        const openDBSpy = vi.spyOn(idb, 'openDB');

        await expect(FiltersStorage.get(1)).resolves.not.toBeUndefined();

        // Get the data from the storage - `get` method calls 5 methods internally,
        // which means 5 calls to `FiltersStorage.getOpenedDb`
        expect(getOpenedDbSpy).toHaveBeenCalledTimes(5);

        // But regardless of the number of calls to `getOpenedDb`, `openDB` should be called only once
        expect(openDBSpy).toHaveBeenCalledTimes(1);

        // Reset the spies
        getOpenedDbSpy.mockClear();
        openDBSpy.mockClear();
    });

    it('sets and gets data correctly', async () => {
        const preprocessed = FilterListPreprocessor.preprocess('@@||example.com^$document');
        await FiltersStorage.setMultiple({
            1: {
                ...preprocessed,
                checksum: 'foo',
            },
            2: {
                ...preprocessed,
                checksum: 'bar',
            },
        });

        // Note: `get` method internally uses these methods:
        // - FiltersStorage.getRawFilterList
        // - FiltersStorage.getFilterList
        // - FiltersStorage.getConversionMap
        // - FiltersStorage.getSourceMap
        // - FiltersStorage.getChecksum
        // So, we don't need to test them separately
        const data = await FiltersStorage.get(1);

        expect(data).not.toBeUndefined();

        // Check that the data is correct
        // Note: Under filterList key we have an Uint8Array, so we need to convert it before comparing
        expect({
            ...{
                ...data,
                filterList: data!.filterList.map(Buffer.from),
            },
            checksum: 'foo',
        }).toEqual({
            ...{
                ...preprocessed,
                filterList: preprocessed.filterList.map(Buffer.from),
            },
            checksum: 'foo',
        });

        // has method should return true for the existing key
        await expect(FiltersStorage.has(1)).resolves.toBeTruthy();

        // has method should return false for the non-existing key
        await expect(FiltersStorage.has(999)).resolves.toBeFalsy();

        // Get filter IDs
        await expect(FiltersStorage.getFilterIds()).resolves.toEqual([1, 2]);

        // Delete the data
        await FiltersStorage.removeMultiple([1, 2]);

        // Check that the data is deleted
        await expect(FiltersStorage.get(1)).resolves.toBeUndefined();
        await expect(FiltersStorage.get(2)).resolves.toBeUndefined();

        // Now has method should return false for the deleted keys
        await expect(FiltersStorage.has(1)).resolves.toBeFalsy();
        await expect(FiltersStorage.has(2)).resolves.toBeFalsy();

        // Also, getFilterIds should return an empty array
        await expect(FiltersStorage.getFilterIds()).resolves.toEqual([]);
    });
});
