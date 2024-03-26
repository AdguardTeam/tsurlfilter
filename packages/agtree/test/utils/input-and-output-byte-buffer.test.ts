import { OutputByteBuffer } from '../../src/utils/output-byte-buffer';
import { InputByteBuffer } from '../../src/utils/input-byte-buffer';
import { SimpleStorage } from '../helpers/simple-storage';
import { ByteBuffer } from '../../src/utils/byte-buffer';

type DataPoolItem =
    | { type: 'Uint8' | 'Uint16' | 'Uint32' | 'Int32' | 'OptimizedUint', value: number }
    | { type: 'String', value: string };

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
                if (typeof output[methodName] === 'function') {
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
                if (typeof input[methodName] === 'function') {
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
            output.writeChunksToStorage(storage, 'test');
            const input = await InputByteBuffer.createFromStorage(storage, 'test');
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            (input as any).isChromium = true;

            expect(input.readString()).toBe(testString);
        };

        test('should work for short strings', async () => {
            await testWithString('Hello, 世界! 👋');
        });

        test('should work for long strings', async () => {
            await testWithString('Hello, 世界! 👋'.repeat(2500));
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
        output.writeChunksToStorage(storage, 'test');
        const input = await InputByteBuffer.createFromStorage(storage, 'test');
        for (let i = 0; i < ByteBuffer.CHUNK_SIZE + 1; i += 1) {
            input.assertUint8(1);
        }
        expect(input.readString()).toBe(testString);
    });

    describe('InputByteBuffer.createFromStorage', () => {
        test('should work on valid data', async () => {
            const storage = new SimpleStorage();

            await storage.set('test', [new Uint8Array(ByteBuffer.CHUNK_SIZE)]);
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

            await storage.set('test', [new Uint8Array([1])]);
            const input = await InputByteBuffer.createFromStorage(storage, 'test');

            expect(() => input.assertUint8(1)).not.toThrow();
        });

        test('should throw error on invalid data', async () => {
            const storage = new SimpleStorage();

            await storage.set('test', [new Uint8Array([1])]);
            const input = await InputByteBuffer.createFromStorage(storage, 'test');

            expect(() => input.assertUint8(2)).toThrow('Expected 2, but got 1');
        });
    });
});
