import { ByteBuffer } from './byte-buffer';

export class U32LinkedList {
    public static readonly EMPTY_POSITION = 0;

    public static add(value: number, buffer: ByteBuffer, listPosition: number) {
        const position = buffer.byteOffset;

        buffer.addUint32(position, value);
        const lastNodePosition = U32LinkedList.getLastNodePosition(buffer, listPosition);
        buffer.addUint32(position + Uint32Array.BYTES_PER_ELEMENT, lastNodePosition);
        U32LinkedList.setLastNodePosition(buffer, listPosition, position);
        const size = U32LinkedList.getSize(buffer, listPosition);
        U32LinkedList.setSize(buffer, listPosition, size + 1);
    }

    public static get(position: number, buffer: ByteBuffer): [value: number, next: number] {
        return [
            buffer.getUint32(position),
            buffer.getUint32(position + Uint32Array.BYTES_PER_ELEMENT),
        ];
    }

    public static forEach(callback: (value: number) => void, buffer: ByteBuffer, listPosition: number): void {
        let cursor = U32LinkedList.getLastNodePosition(buffer, listPosition);

        while (cursor !== U32LinkedList.EMPTY_POSITION) {
            const [nodeValue, nextNodePosition] = U32LinkedList.get(cursor, buffer);
            callback(nodeValue);
            cursor = nextNodePosition;
        }
    }

    public static create(buffer: ByteBuffer): number {
        const { byteOffset } = buffer;

        buffer.addUint32(byteOffset, 0);
        buffer.addUint32(byteOffset + Uint32Array.BYTES_PER_ELEMENT, U32LinkedList.EMPTY_POSITION);

        return byteOffset;
    }

    private static getSize(buffer: ByteBuffer, listPosition: number) {
        return buffer.getUint32(listPosition);
    }

    private static setSize(buffer: ByteBuffer, listPosition: number, value: number) {
        buffer.setUint32(listPosition, value);
    }

    private static getLastNodePosition(buffer: ByteBuffer, listPosition: number): number {
        return buffer.getUint32(listPosition + Uint32Array.BYTES_PER_ELEMENT);
    }

    private static setLastNodePosition(buffer: ByteBuffer, listPosition: number, value: number) {
        buffer.setUint32(listPosition + Uint32Array.BYTES_PER_ELEMENT, value);
    }
}
