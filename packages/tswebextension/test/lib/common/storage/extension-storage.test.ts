import browser from 'webextension-polyfill';

import { ExtensionStorage } from '../../../../src/lib/common/storage';

describe('ExtensionStorage', () => {
    const key = 'test-key';
    const data = { foo: 'bar', baz: 42 };
    const api = browser.storage.local;

    it('should initialize the storage', async () => {
        const storage = new ExtensionStorage<typeof data>(key, api);
        await storage.init(data);

        expect(storage.get('foo')).toBe('bar');
        expect(storage.get('baz')).toBe(42);
    });

    it('should get the value by the specified key', async () => {
        const storage = new ExtensionStorage<typeof data>(key, api);
        await storage.init(data);

        expect(storage.get('foo')).toBe('bar');
        expect(storage.get('baz')).toBe(42);
    });

    it('should set the value by the specified key', async () => {
        const storage = new ExtensionStorage<typeof data>(key, api);
        await storage.init(data);

        storage.set('foo', 'new-bar');

        expect(storage.get('foo')).toBe('new-bar');
    });

    it('should delete the value by the specified key', async () => {
        const storage = new ExtensionStorage<typeof data>(key, api);
        await storage.init(data);

        storage.delete('foo');

        expect(storage.get('foo')).toBeUndefined();
        expect(storage.get('baz')).toBe(42);
    });

    it('should throw an error if storage is not initialized', () => {
        const storage = new ExtensionStorage<typeof data>(key, api);

        expect(() => storage.get('foo')).toThrow('Storage not initialized');
        expect(() => storage.set('foo', 'bar')).toThrow('Storage not initialized');
        expect(() => storage.delete('foo')).toThrow('Storage not initialized');
    });
});
