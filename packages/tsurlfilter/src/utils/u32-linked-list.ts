import { ByteBuffer } from './byte-buffer';

export class U32LinkedList {
    public static readonly EMPTY_POSITION = 0;

    public readonly buffer: ByteBuffer;

    public readonly offset: number;

    public get size(): number {
        return this.buffer.getUint32(this.offset);
    }

    public set size(value: number) {
        this.buffer.setUint32(this.offset, value);
    }

    public get lastNodePosition(): number {
        return this.buffer.getUint32(this.offset + Uint32Array.BYTES_PER_ELEMENT);
    }

    public set lastNodePosition(value: number) {
        this.buffer.setUint32(this.offset + Uint32Array.BYTES_PER_ELEMENT, value);
    }

    constructor(buffer: ByteBuffer, offset: number) {
        this.buffer = buffer;
        this.offset = offset;
    }

    public add(value: number) {
        const position = this.buffer.byteOffset;

        this.buffer.addUint32(position, value);
        this.buffer.addUint32(position + Uint32Array.BYTES_PER_ELEMENT, this.lastNodePosition);

        this.lastNodePosition = position;
        this.size += 1;
    }

    public get(position: number): [value: number, next: number] {
        return [
            this.buffer.getUint32(position),
            this.buffer.getUint32(position + Uint32Array.BYTES_PER_ELEMENT),
        ];
    }

    public forEach(callback: (value: number) => void): void {
        let cursor = this.lastNodePosition;

        while (cursor !== U32LinkedList.EMPTY_POSITION) {
            const [nodeValue, nextNodePosition] = this.get(cursor);
            callback(nodeValue);
            cursor = nextNodePosition;
        }
    }

    public static create(buffer: ByteBuffer): U32LinkedList {
        const { byteOffset } = buffer;

        buffer.addUint32(byteOffset, 0);
        buffer.addUint32(byteOffset + Uint32Array.BYTES_PER_ELEMENT, U32LinkedList.EMPTY_POSITION);

        return new U32LinkedList(buffer, byteOffset);
    }
}
