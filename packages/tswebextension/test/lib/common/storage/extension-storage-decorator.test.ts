/* eslint-disable jsdoc/require-jsdoc */
import browser from 'webextension-polyfill';
import { createExtensionStorageDecorator } from '@lib/common/storage/extension-storage-decorator';
import { ExtensionStorage } from '@lib/common/storage/extension-storage';

describe('createExtensionStorageDecorator', () => {
    const key = 'test-key';
    const data = { foo: 'bar', baz: 42 };
    let storage: ExtensionStorage<typeof data>;

    beforeAll(async () => {
        storage = new ExtensionStorage(key, browser.storage.local);
        await storage.init(data);
    });

    it('should create a decorator', () => {
        const decorator = createExtensionStorageDecorator(storage)('foo');

        expect(typeof decorator).toBe('function');
    });

    it('should throw an error if decorator is already registered for the storage field', () => {
        const decorator = createExtensionStorageDecorator(storage);
        decorator('foo');
        expect(() => decorator('foo')).toThrow(
            'Decorator for foo field is already registered',
        );
    });

    it('should throw an error if decorator is applied to non-auto accessor', () => {
        const fieldDecorator = createExtensionStorageDecorator(storage)('foo');

        // Required for test runtime errors
        // @ts-ignore
        expect(() => fieldDecorator({}, { kind: 'method' })).toThrow(
            'Class member is not auto accessor',
        );
    });

    it('should get and set the value of the specified field', () => {
        const decorator = createExtensionStorageDecorator(storage);

        class TestClass {
            @decorator('foo')
            accessor foo!: string
        }

        const instance = new TestClass();

        expect(instance.foo).toBe('bar');

        instance.foo = 'new-value';

        expect(instance.foo).toBe('new-value');
        expect(storage.get('foo')).toBe('new-value');
    });
});
