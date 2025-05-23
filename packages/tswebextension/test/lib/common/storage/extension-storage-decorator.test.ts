/* eslint-disable jsdoc/require-jsdoc */
import {
    describe,
    expect,
    beforeAll,
    it,
} from 'vitest';
import browser from 'webextension-polyfill';

import { BrowserStorage } from '../../../../src/lib/common/storage/core';
import { createExtensionStorageDecorator, ExtensionStorage } from '../../../../src/lib/common/storage';

describe('createExtensionStorageDecorator', () => {
    const key = 'test-key';
    const data = { foo: 'bar', baz: 42 };
    let storage: ExtensionStorage<typeof data>;

    beforeAll(async () => {
        storage = new ExtensionStorage(key, new BrowserStorage<typeof data>(browser.storage.local));
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
            'Class member is not an accessor',
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
