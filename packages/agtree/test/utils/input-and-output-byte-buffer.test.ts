import {
    describe,
    expect,
    test,
    vi,
} from 'vitest';

import { OutputByteBuffer } from '../../src/utils/output-byte-buffer';
import { InputByteBuffer } from '../../src/utils/input-byte-buffer';
import { SimpleStorage } from '../helpers/simple-storage';
import { ByteBuffer } from '../../src/utils/byte-buffer';
import { BINARY_SCHEMA_VERSION } from '../../src/utils/binary-schema-version';
import { BinarySchemaMismatchError } from '../../src/errors/binary-schema-mismatch-error';

type DataPoolItem =
    | { type: 'Uint8' | 'Uint16' | 'Uint32' | 'Int32' | 'OptimizedUint'; value: number }
    | { type: 'String'; value: string };

describe('ByteBuffer', () => {
    test('should write and read data correctly', async () => {
        const dataPool: DataPoolItem[] = [
            { type: 'Uint8', value: 1 },
            { type: 'Uint8', value: 2 ** 8 - 1 },

            { type: 'Uint16', value: 1 },
            { type: 'Uint16', value: 2 ** 16 - 1 },

            { type: 'Uint32', value: 1 },
            { type: 'Uint32', value: 2 ** 31 - 1 },

            { type: 'String', value: 'Hello, 世界! 👋' },
            { type: 'String', value: 'Hello, 世界! 👋'.repeat(5000) },
            { type: 'String', value: 'a'.repeat(2 ** 16 - 1) },

            { type: 'Uint32', value: 2 ** 32 - 1 },

            { type: 'Int32', value: 0 },
            { type: 'Int32', value: -1 },
            { type: 'Int32', value: 1 },
            { type: 'Int32', value: 2 ** 31 - 1 },
            { type: 'Int32', value: -(2 ** 31) },

            { type: 'OptimizedUint', value: 0 },
            { type: 'OptimizedUint', value: 1 },
            { type: 'OptimizedUint', value: 2 ** 8 - 1 },
            { type: 'OptimizedUint', value: 2 ** 16 - 1 },
            { type: 'OptimizedUint', value: OutputByteBuffer.MAX_OPTIMIZED_UINT },
        ];

        const output = new OutputByteBuffer();

        for (const { type, value } of dataPool) {
            if (type === 'String') {
                output.writeString(value);
            } else {
                const methodName = `write${type}`;
                // TODO: Improve types
                // @ts-expect-error(7053)
                if (typeof output[methodName] === 'function') {
                    // TODO: Improve types
                    // @ts-expect-error(7053)
                    output[methodName](value);
                }
            }
        }

        const storage = new SimpleStorage();
        await output.writeChunksToStorage(storage, 'test');

        const input = await InputByteBuffer.createFromStorage(storage, 'test');

        for (const { type, value } of dataPool) {
            if (type === 'String') {
                expect(input.readString()).toBe(value);
            } else {
                const methodName = `read${type}`;
                // TODO: Improve types
                // @ts-expect-error(7053)
                if (typeof input[methodName] === 'function') {
                    // TODO: Improve types
                    // @ts-expect-error(7053)
                    expect(input[methodName]()).toBe(value);
                }
            }
        }
    });

    describe('text encoder / decoder polyfill should work in chrome', () => {
        const testWithString = async (testString: string) => {
            const output = new OutputByteBuffer();
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            (output as any).isChromium = true;
            output.writeString(testString);

            const storage = new SimpleStorage();
            await output.writeChunksToStorage(storage, 'test');
            const input = await InputByteBuffer.createFromStorage(storage, 'test');
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            (input as any).isChromium = true;

            expect(input.readString()).toBe(testString);
        };

        test('should work for short strings', async () => {
            await testWithString('Hello, 世界! 👋');
        });

        test('should work for long strings', async () => {
            await testWithString('Hello, 世界! 👋'.repeat(25000));
        });
    });

    test('should expand the buffer if needed', async () => {
        // output and input byte buffers extends the base byte buffer class,
        // but we don't test the base class directly
        // here, we test the correct chunking behavior if we write more data than a single chunk can hold
        const output = new OutputByteBuffer();
        for (let i = 0; i < ByteBuffer.CHUNK_SIZE + 1; i += 1) {
            output.writeUint8(1);
        }
        const testString = 'a'.repeat(ByteBuffer.CHUNK_SIZE + 1);
        output.writeString(testString);

        const storage = new SimpleStorage();
        await output.writeChunksToStorage(storage, 'test');
        const input = await InputByteBuffer.createFromStorage(storage, 'test');
        for (let i = 0; i < ByteBuffer.CHUNK_SIZE + 1; i += 1) {
            input.assertUint8(1);
        }
        expect(input.readString()).toBe(testString);
    });

    describe('InputByteBuffer.createFromStorage', () => {
        test('should work on valid data', async () => {
            const storage = new SimpleStorage();
            const output = new OutputByteBuffer();
            await output.writeChunksToStorage(storage, 'test');

            await expect(
                InputByteBuffer.createFromStorage(storage, 'test'),
            ).resolves.toBeInstanceOf(InputByteBuffer);
        });

        test('should throw error on invalid data', async () => {
            const storage = new SimpleStorage();

            const testStorage = async (key: string) => {
                await expect(
                    InputByteBuffer.createFromStorage(storage, key),
                ).rejects.toThrow(
                    'The data from storage is not an array of Uint8Arrays',
                );
            };

            await storage.set('test', [new Uint32Array(ByteBuffer.CHUNK_SIZE)]);
            await testStorage('test');

            await storage.set('test', new Uint8Array(ByteBuffer.CHUNK_SIZE));
            await testStorage('test');
        });
    });

    describe('InputByteBuffer.assertUint8', () => {
        test('should work on valid data', async () => {
            const storage = new SimpleStorage();
            const output = new OutputByteBuffer();
            output.writeUint8(1);
            await output.writeChunksToStorage(storage, 'test');
            const input = await InputByteBuffer.createFromStorage(storage, 'test');

            expect(() => input.assertUint8(1)).not.toThrow();
        });

        test('should throw error on invalid data', async () => {
            const storage = new SimpleStorage();
            const output = new OutputByteBuffer();
            output.writeUint8(1);
            await output.writeChunksToStorage(storage, 'test');
            const input = await InputByteBuffer.createFromStorage(storage, 'test');

            expect(() => input.assertUint8(2)).toThrow('Expected 2, but got 1');
        });
    });

    describe('InputByteBuffer.createCopyWithOffset', () => {
        test('should work on valid data', async () => {
            const storage = new SimpleStorage();
            const output = new OutputByteBuffer();
            output.writeUint8(100);
            output.writeUint8(101);
            output.writeUint8(102);
            await output.writeChunksToStorage(storage, 'test');

            // make the original input buffer read the first byte
            const input = await InputByteBuffer.createFromStorage(storage, 'test');
            expect(input.readUint8()).toBe(100);

            // make a copy of the input buffer and read the first two bytes from the copy
            const copy = input.createCopyWithOffset(0, false);
            expect(copy.readUint8()).toBe(100);
            expect(copy.readUint8()).toBe(101);

            // reading from the copy should not affect the original buffer
            expect(input.readUint8()).toBe(101);
            expect(input.readUint8()).toBe(102);
        });

        test('should throw error on invalid data', async () => {
            const storage = new SimpleStorage();
            const output = new OutputByteBuffer();
            output.writeUint8(1);
            await output.writeChunksToStorage(storage, 'test');
            const input = await InputByteBuffer.createFromStorage(storage, 'test');

            expect(() => input.createCopyWithOffset(-1)).toThrow('Invalid offset: -1');
            expect(() => input.createCopyWithOffset(ByteBuffer.CHUNK_SIZE + 1)).toThrow(
                `Invalid offset: ${ByteBuffer.CHUNK_SIZE + 1}`,
            );
        });
    });

    describe('Binary schema version write / read', () => {
        test('should write schema version', async () => {
            const output = new OutputByteBuffer();
            const storage = new SimpleStorage();
            await output.writeChunksToStorage(storage, 'test');
            const input = await InputByteBuffer.createFromStorage(storage, 'test');

            expect(input.readSchemaVersion()).toEqual(BINARY_SCHEMA_VERSION);
        });

        test('should throw error on incompatible schema version', async () => {
            // OutputByteBuffer's constructor writes the schema version,
            // so we just need to mock the first call to writeUint32ToIndex to leave values as 0,
            // since schema version is at least 1
            vi.spyOn(
                OutputByteBuffer.prototype,
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                'writeUint32ToIndex' as any,
            ).mockImplementationOnce(() => {
                // do nothing, so leave values as 0, but return 4 to simulate writing of 4 bytes
                return 4;
            });

            const output = new OutputByteBuffer();
            output.writeUint8(0); // write some data to the buffer, because mock skip first write
            const storage = new SimpleStorage();

            await output.writeChunksToStorage(storage, 'test');

            // InputByteBuffer's constructor reads the schema version,
            // and it should throw an error if the schema version is not compatible
            let error: unknown;

            try {
                await InputByteBuffer.createFromStorage(storage, 'test');
            } catch (e: unknown) {
                error = e;
            }

            expect(error).toBeInstanceOf(BinarySchemaMismatchError);
            expect(error).toHaveProperty(
                'message',
                `Expected schema version ${BINARY_SCHEMA_VERSION}, but got 0`,
            );
            expect(error).toHaveProperty('expectedVersion', BINARY_SCHEMA_VERSION);
            expect(error).toHaveProperty('actualVersion', 0);
        });
    });
});
