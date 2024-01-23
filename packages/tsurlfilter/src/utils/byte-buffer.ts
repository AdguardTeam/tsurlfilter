export class ByteBuffer {
    public chunks: Uint8Array[] = [];

    public byteOffset: number = 0;

    public get byteLength(): number {
        return this.chunks.length << 6;
    }

    constructor(chunks: Uint8Array[] = []) {
        this.chunks = chunks;
    }

    public setUint8(byteOffset: number, value: number): void {
        this.chunks[byteOffset >> 6][byteOffset & 63] = value;
    }

    public getUint8(byteOffset: number): number {
        return this.chunks[byteOffset >> 6][byteOffset & 63];
    }

    public addUint8(byteOffset: number, value: number): void {
        if (!this.hasCapacity(byteOffset)) {
            this.allocate();
        }

        this.setUint8(byteOffset, value);
        this.byteOffset += 1;
    }

    public setUint32(byteOffset: number, value: number) {
        this.setUint8(byteOffset, value >> 24);
        this.setUint8(byteOffset + 1, value >> 16);
        this.setUint8(byteOffset + 2, value >> 8);
        this.setUint8(byteOffset + 3, value);
    }

    public getUint32(byteOffset: number) {
        return ((this.getUint8(byteOffset + 3) << 0)
            | (this.getUint8(byteOffset + 2) << 8)
            | (this.getUint8(byteOffset + 1) << 16)
            | (this.getUint8(byteOffset + 0) << 24)) >>> 0;
    }

    public addUint32(byteOffset: number, value: number): void {
        if (!this.hasCapacity(byteOffset + 3)) {
            this.allocate();
        }

        this.setUint32(byteOffset, value);
        this.byteOffset += 4;
    }

    private hasCapacity(index: number): boolean {
        return index + 1 >> 6 < this.chunks.length;
    }

    private allocate(): void {
        this.chunks.push(new Uint8Array(64));
    }
}
