import {
    afterEach,
    beforeEach,
    describe,
    expect,
    test,
    vi,
} from 'vitest';

import { IDBStorage } from '../../../../../src/lib/common/storage/core/idb-storage';

describe('IDBStorage', () => {
    let storage: IDBStorage<any>;

    beforeEach(() => {
        storage = new IDBStorage();
    });

    afterEach(async () => {
        await storage.clear();
        vi.clearAllMocks();
    });

    test('set and get', async () => {
        await storage.set('key1', 'value1');
        const value = await storage.get('key1');
        expect(value).toBe('value1');
    });

    test('remove', async () => {
        await storage.set('key2', 'value2');
        await storage.remove('key2');
        const value = await storage.get('key2');
        expect(value).toBeUndefined();
    });

    test('setMultiple', async () => {
        const data = { key3: 'value3', key4: 'value4' };
        const result = await storage.setMultiple(data);
        expect(result).toBe(true);
        const value3 = await storage.get('key3');
        const value4 = await storage.get('key4');
        expect(value3).toBe('value3');
        expect(value4).toBe('value4');
    });

    test('removeMultiple', async () => {
        await storage.set('key5', 'value5');
        await storage.set('key6', 'value6');
        const result = await storage.removeMultiple(['key5', 'key6']);
        expect(result).toBe(true);
        const value5 = await storage.get('key5');
        const value6 = await storage.get('key6');
        expect(value5).toBeUndefined();
        expect(value6).toBeUndefined();
    });

    test('entries', async () => {
        await storage.set('key7', 'value7');
        await storage.set('key8', 'value8');
        const entries = await storage.entries();
        expect(entries).toEqual({ key7: 'value7', key8: 'value8' });
    });

    test('keys', async () => {
        await storage.set('key9', 'value9');
        await storage.set('key10', 'value10');
        const keys = await storage.keys();
        expect(keys).toEqual(expect.arrayContaining(['key9', 'key10']));
    });

    test('has', async () => {
        await storage.set('key11', 'value11');
        const hasKey = await storage.has('key11');
        expect(hasKey).toBe(true);
        const hasKey12 = await storage.has('key12');
        expect(hasKey12).toBe(false);
    });

    test('clear', async () => {
        await storage.set('key13', 'value13');
        await storage.set('key14', 'value14');
        await storage.clear();
        const entries = await storage.entries();
        expect(entries).toEqual({});
    });

    // TODO: Add tests to check error handling in setMultiple and removeMultiple
});
