export class ByteBuffer {
    public chunks: Uint8Array[] = [];

    public byteOffset: number = 0;

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

    public getFloat64(byteOffset: number) {
        const integral = this.getUint32(byteOffset);
        const fractional = this.getUint32(byteOffset + 4);

        return fractional / 1_000_000 + integral;
    }

    public setFloat64(byteOffset: number, value: number) {
        const integral = Math.trunc(value);
        const fractional = Math.round((value % 1) * 1_000_000);

        this.setUint32(byteOffset, integral);
        this.setUint32(byteOffset + 4, fractional);
    }

    public addFloat64(byteOffset: number, value: number): void {
        if (!this.hasCapacity(byteOffset + 7)) {
            this.allocate();
        }

        this.setFloat64(byteOffset, value);
        this.byteOffset += 8;
    }

    private hasCapacity(index: number): boolean {
        return index + 1 >> 6 < this.chunks.length;
    }

    private allocate(): void {
        this.chunks.push(new Uint8Array(64));
    }
}
