import { OutputByteBuffer } from '../../src/utils/output-byte-buffer';
import { InputByteBuffer } from '../../src/utils/input-byte-buffer';
import { SimpleStorage } from '../helpers/simple-storage';
import { ByteBuffer } from '../../src/utils/byte-buffer';

type DataPoolItem =
    | { type: 'Uint8' | 'Uint16' | 'Uint32' | 'Int32', value: number }
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
            { type: 'String', value: 'a'.repeat(2 ** 16 - 1) },

            { type: 'Uint32', value: 2 ** 32 - 1 },

            { type: 'Int32', value: 0 },
            { type: 'Int32', value: -1 },
            { type: 'Int32', value: 1 },
            { type: 'Int32', value: 2 ** 31 - 1 },
            { type: 'Int32', value: -(2 ** 31) },
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

    describe('InputByteBuffer.createFromStorage', () => {
        test('should work on valid data', async () => {
            const storage = new SimpleStorage();

            await storage.write('test', [new Uint8Array(ByteBuffer.CHUNK_SIZE)]);
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

            await storage.write('test', [new Uint32Array(ByteBuffer.CHUNK_SIZE)]);
            await testStorage('test');

            await storage.write('test', new Uint8Array(ByteBuffer.CHUNK_SIZE));
            await testStorage('test');
        });
    });

    // FIXME: test InputByteBuffer.assertUint8
});
