import { MemoryStorage } from '@lib/mv2/background/memory-storage';

describe('MemoryStorage', () => {
    let memoryStorage: MemoryStorage;

    beforeEach(() => {
        memoryStorage = new MemoryStorage();
    });

    afterEach(() => {
        memoryStorage.clear();
    });

    describe('get', () => {
        it('should return empty object if no data', async () => {
            const result = await memoryStorage.get();

            expect(result).toEqual({});
        });

        it('should return empty object if no data for specified key', async () => {
            const data = { foo: 1 };
            await memoryStorage.set(data);
            const result = await memoryStorage.get('bar');

            expect(result).toEqual({});
        });

        it('should return data for specified key', async () => {
            const data = { foo: 1 };
            await memoryStorage.set(data);

            const result = await memoryStorage.get('foo');
            expect(result).toEqual(data);
        });

        it('should return data for array of keys', async () => {
            const data = { foo: 1, bar: 2 };
            await memoryStorage.set(data);

            const result = await memoryStorage.get(['foo', 'bar']);
            expect(result).toEqual(data);
        });

        it('should return data for record of keys', async () => {
            const data = { foo: 1, bar: 2 };
            await memoryStorage.set(data);

            const expected = {
                bar: 2,
                baz: 3,
            };

            const result = await memoryStorage.get({ bar: 0, baz: 3 });
            expect(result).toEqual(expected);
        });

        it('should return all data if no keys', async () => {
            const data = { foo: 1, bar: 2 };
            await memoryStorage.set(data);

            let result = await memoryStorage.get();
            expect(result).toEqual(data);

            result = await memoryStorage.get(null);
            expect(result).toEqual(data);
        });

        it('should return empty object if empty string', async () => {
            const data = { foo: 1, bar: 2 };
            await memoryStorage.set(data);

            const result = await memoryStorage.get('');
            expect(result).toEqual({});
        });
    });

    describe('set', () => {
        it('should set new data correctly', async () => {
            const data = { foo: 1, bar: 2 };
            await memoryStorage.set(data);

            const result = await memoryStorage.get();
            expect(result).toEqual(data);
        });

        it('should overwrite data correctly', async () => {
            const data = { foo: 1, bar: 2 };
            await memoryStorage.set(data);

            await memoryStorage.set({ bar: 4 });

            const result = await memoryStorage.get();
            expect(result).toEqual({ foo: 1, bar: 4 });
        });
    });

    describe('remove', () => {
        it('should remove data by key correctly', async () => {
            const data = { foo: 1, bar: 2 };
            await memoryStorage.set(data);

            await memoryStorage.remove('foo');

            const result = await memoryStorage.get();
            expect(result).toEqual({ bar: 2 });
        });

        it('should remove data by array of keys correctly', async () => {
            const data = { foo: 1, bar: 2 };
            await memoryStorage.set(data);

            await memoryStorage.remove(['foo', 'bar']);

            const result = await memoryStorage.get();
            expect(result).toEqual({});
        });

        it('should ignore unknown key', async () => {
            const data = { foo: 1, bar: 2 };
            await memoryStorage.set(data);

            await memoryStorage.remove('baz');

            const result = await memoryStorage.get();
            expect(result).toEqual(data);
        });
    });

    describe('clear', () => {
        it('should clear data correctly', async () => {
            const data = { foo: 1, bar: 2 };
            await memoryStorage.set(data);

            await memoryStorage.clear();

            const result = await memoryStorage.get();
            expect(result).toEqual({});
        });
    });
});
