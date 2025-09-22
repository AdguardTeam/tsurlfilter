import { describe, expect, it } from 'vitest';
import { ConvertedFilterList } from '@adguard/tsurlfilter';

import { IdbSingleton } from '../../../../src/lib/common/idb-singleton';
import { FiltersStorage } from '../../../../src/lib/common/storage/filters';

describe('FiltersStorage', () => {
    it('does not delete content if the db version increases', async () => {
        // Insert data into storage
        const converted = new ConvertedFilterList('@@||example.com^$document');
        await FiltersStorage.setMultiple({
            1: {
                rawFilterList: converted.getContent(),
                conversionData: converted.getConversionData(),
                checksum: 'foo',
            },
        });

        // Check that the data is correctly stored
        await expect(FiltersStorage.get(1)).resolves.not.toBeUndefined();

        // Increase database version by adding a new store
        await IdbSingleton.getOpenedDb('foo');

        // Reopen the DB and check that the data is still present
        await expect(FiltersStorage.get(1)).resolves.not.toBeUndefined();
    });

    it('sets and gets data correctly', async () => {
        const converted = new ConvertedFilterList('@@||example.com^$document');
        await FiltersStorage.setMultiple({
            1: {
                rawFilterList: converted.getContent(),
                conversionData: converted.getConversionData(),
                checksum: 'foo',
            },
            2: {
                rawFilterList: converted.getContent(),
                conversionData: converted.getConversionData(),
                checksum: 'bar',
            },
        });

        // Note: `get` method internally uses these methods:
        // - FiltersStorage.getRawFilterList
        // - FiltersStorage.getConversionData
        // - FiltersStorage.getChecksum
        // So, we don't need to test them separately
        const data = await FiltersStorage.get(1);

        expect(data).not.toBeUndefined();

        expect({
            ...data,
            checksum: 'foo',
        }).toEqual({
            rawFilterList: converted.getContent(),
            conversionData: converted.getConversionData(),
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
