import { ByteBuffer } from '../../src/utils/byte-buffer';
import { SimpleStorage } from '../helpers/simple-storage';
import { isArrayOfUint8Arrays } from '../../src/utils/type-guards';

let buffer: ByteBuffer;

beforeEach(() => {
    buffer = new ByteBuffer();
});

describe('ByteBuffer', () => {
    test('should write and read bytes', () => {
        buffer.writeByte(0, 0x48);
        buffer.writeByte(1, 0x65);
        // overwrite the second byte
        buffer.writeByte(1, 0x6C);

        expect(buffer.readByte(0)).toBe(0x48);
        expect(buffer.readByte(1)).toBe(0x6C);

        // read out of bounds
        expect(buffer.readByte(ByteBuffer.CHUNK_SIZE + 1)).toBeUndefined();
    });

    test('should expand buffer if the first chunk is full', () => {
        // fill the first chunk
        let i = 0;
        for (; i < ByteBuffer.CHUNK_SIZE; i += 1) {
            buffer.writeByte(i, 0xFF);
        }

        // write one more byte
        buffer.writeByte(i, 0xFF);

        // the following call is only gives the proper value if the buffer was expanded
        expect(buffer.readByte(i)).toBe(0xFF);
    });

    test('should expand buffer if the given position is larger than the buffer size', () => {
        const position = ByteBuffer.CHUNK_SIZE * 2 + 1;
        buffer.writeByte(position, 0xFF);

        // the following call is only gives the proper value if the buffer was expanded
        expect(buffer.readByte(position)).toBe(0xFF);
    });

    test('should extract chunks into a storage', async () => {
        // spy on the storage
        const storage = new SimpleStorage();
        const writeSpy = jest.spyOn(storage, 'set');

        for (let i = 0; i < ByteBuffer.CHUNK_SIZE * 2; i += 1) {
            buffer.writeByte(i, 0xFF);
        }

        await buffer.writeChunksToStorage(storage, 'test');

        // check if the storage was called with the correct chunks
        expect(writeSpy).toHaveBeenCalledWith('test', [
            new Uint8Array(ByteBuffer.CHUNK_SIZE).fill(0xFF),
            new Uint8Array(ByteBuffer.CHUNK_SIZE).fill(0xFF),
        ]);
    });

    test('should re-create buffer from storage', async () => {
        const storage = new SimpleStorage();
        buffer.writeByte(ByteBuffer.CHUNK_SIZE + 1, 0xFF);
        await buffer.writeChunksToStorage(storage, 'test');

        const dataFromStorage = await storage.get('test');

        if (!isArrayOfUint8Arrays(dataFromStorage)) {
            throw new Error('The data from storage is not an array of Uint8Arrays');
        }

        const newBuffer = new ByteBuffer(dataFromStorage);

        // check if the new buffer has the same content
        expect(newBuffer.readByte(ByteBuffer.CHUNK_SIZE + 1)).toBe(0xFF);
    });
});
