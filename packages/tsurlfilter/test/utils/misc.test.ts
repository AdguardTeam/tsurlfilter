// @vitest-environment node

import {
    afterEach,
    beforeEach,
    describe,
    expect,
    it,
    vi,
} from 'vitest';

import { TAB } from '../../src/common/constants';
import { base64ToUint8Array, serializeJson, uint8ArrayToBase64 } from '../../src/utils/misc';

describe('Utility Functions', () => {
    const originalWindow = global.window;

    beforeEach(() => {
        vi.resetModules();
    });

    afterEach(() => {
        // Restore the original window object after each test
        global.window = originalWindow;
    });

    describe('uint8ArrayToBase64 and base64ToUint8Array', () => {
        it('should encode and decode Uint8Array correctly in Node.js environment', () => {
            const byteArray = new TextEncoder().encode('Hello, こんにちは!');
            const base64String = uint8ArrayToBase64(byteArray);
            const decodedArray = base64ToUint8Array(base64String);

            // Ensure round-trip encoding/decoding works correctly
            expect(decodedArray).toEqual(byteArray);
        });

        it('should encode and decode Uint8Array correctly in browser environment', () => {
            (global as any).window = { btoa, atob }; // Mock browser environment functions

            const byteArray = new TextEncoder().encode('Hello, こんにちは!');
            const base64String = uint8ArrayToBase64(byteArray);
            const decodedArray = base64ToUint8Array(base64String);

            expect(decodedArray).toEqual(byteArray);
        });

        it('should handle an empty Uint8Array', () => {
            const byteArray = new Uint8Array();
            const base64String = uint8ArrayToBase64(byteArray);
            const decodedArray = base64ToUint8Array(base64String);

            expect(base64String).toBe(''); // Empty string in base64
            expect(decodedArray).toEqual(byteArray);
        });
    });

    describe('serializeJson', () => {
        it('should serialize data to compact JSON by default', () => {
            const data = { name: 'John', age: 30 };
            const expectedJson = '{"name":"John","age":30}';

            const result = serializeJson(data);
            expect(result).toBe(expectedJson);
        });

        it('should serialize data to prettified JSON when pretty is true', () => {
            const data = { name: 'John', age: 30 };
            const expectedJson = JSON.stringify(data, null, TAB);

            const result = serializeJson(data, true);

            expect(result).toBe(expectedJson);
        });

        it('should handle arrays correctly', () => {
            const data = [1, 2, 3];
            const expectedJson = '[1,2,3]';

            const result = serializeJson(data);

            expect(result).toBe(expectedJson);
        });

        it('should handle undefined and null values', () => {
            const data = { a: undefined, b: null };
            // undefined properties are omitted from JSON
            const expectedJson = '{"b":null}';

            const result = serializeJson(data);

            expect(result).toBe(expectedJson);
        });
    });
});
