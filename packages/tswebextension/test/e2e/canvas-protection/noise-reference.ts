const MASK = (1n << 64n) - 1n;

/**
 * Rotates one unsigned 64-bit reference word.
 *
 * @param value Word to rotate.
 * @param bits Rotation distance.
 *
 * @returns Rotated reference word.
 */
const rotate = (value: bigint, bits: bigint): bigint => (
    ((value << bits) | (value >> (64n - bits))) & MASK
);

/**
 * Computes SipHash-2-4 independently with unsigned BigInt words.
 *
 * @param key Sixteen-byte key.
 * @param bytes Message bytes.
 *
 * @returns Unsigned 64-bit digest.
 */
export const referenceSipHash = (key: Uint8Array, bytes: Uint8Array): bigint => {
    const keyView = new DataView(key.buffer, key.byteOffset, key.byteLength);
    const key0 = keyView.getBigUint64(0, true);
    const key1 = keyView.getBigUint64(8, true);
    const state = [
        0x736f6d6570736575n ^ key0,
        0x646f72616e646f6dn ^ key1,
        0x6c7967656e657261n ^ key0,
        0x7465646279746573n ^ key1,
    ];
    const round = (): void => {
        state[0] = (state[0] + state[1]) & MASK;
        state[1] = rotate(state[1], 13n) ^ state[0];
        state[0] = rotate(state[0], 32n);
        state[2] = (state[2] + state[3]) & MASK;
        state[3] = rotate(state[3], 16n) ^ state[2];
        state[0] = (state[0] + state[3]) & MASK;
        state[3] = rotate(state[3], 21n) ^ state[0];
        state[2] = (state[2] + state[1]) & MASK;
        state[1] = rotate(state[1], 17n) ^ state[2];
        state[2] = rotate(state[2], 32n);
    };
    const compress = (word: bigint): void => {
        state[3] ^= word;
        round();
        round();
        state[0] ^= word;
    };
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    const complete = bytes.length - (bytes.length % 8);
    for (let offset = 0; offset < complete; offset += 8) {
        compress(view.getBigUint64(offset, true));
    }
    let last = BigInt(bytes.length & 255) << 56n;
    for (let offset = complete; offset < bytes.length; offset += 1) {
        last |= BigInt(bytes[offset]) << BigInt((offset - complete) * 8);
    }
    compress(last);
    state[2] ^= 255n;
    for (let index = 0; index < 4; index += 1) {
        round();
    }
    return state[0] ^ state[1] ^ state[2] ^ state[3];
};

/**
 * Multiplies two words modulo 2^32 with BigInt, independently of `Math.imul`.
 *
 * @param left First word.
 * @param right Second word.
 *
 * @returns Unsigned 32-bit product.
 */
const multiply32 = (left: number, right: number): number => (
    Number((BigInt(left >>> 0) * BigInt(right >>> 0)) & 0xffffffffn)
);

/**
 * Constructs the expected sparse source bitmap without a protected canvas readout.
 *
 * @param source Original source pixels at the native snapshot boundary.
 * @param seed Captured fixture site key.
 *
 * @returns Independently protected source bytes with native alpha and nonopaque pixels.
 */
export const referenceSourceNoise = (source: ImageData, seed: Uint8Array): Uint8ClampedArray => {
    const output = new Uint8ClampedArray(source.data);
    const message = new Uint8Array(5);
    const view = new DataView(message.buffer);
    message[0] = 4;
    for (let y = 0; y < source.height; y += 1) {
        view.setUint32(1, y, true);
        const digest = referenceSipHash(seed, message);
        const key0 = Number(digest & 0xffffffffn);
        const key1 = Number(digest >> 32n);
        for (let x = 0; x < source.width; x += 1) {
            const offset = (y * source.width + x) * 4;
            if (source.data[offset + 3] !== 255) {
                continue;
            }
            const rgb = source.data[offset] + source.data[offset + 1] * 0x100 + source.data[offset + 2] * 0x10000;
            let hash = (multiply32(rgb ^ key0, 0x9e3779b1) ^ multiply32(x ^ key1, 0x85ebca6b)) >>> 0;
            hash = (hash ^ (hash >>> 16)) >>> 0;
            hash = multiply32(hash, 0x21f0aaad);
            hash = (hash ^ (hash >>> 15)) >>> 0;
            hash = multiply32(hash, 0x735a2d97);
            hash = (hash ^ (hash >>> 15)) >>> 0;
            if (hash % 16 !== 0) {
                continue;
            }
            const channel = Math.floor(((Math.floor(hash / 16) % 0x10000) * 3) / 0x10000);
            const value = source.data[offset + channel];
            let direction: number;
            if (value === 0) {
                direction = 1;
            } else if (value === 255) {
                direction = -1;
            } else {
                direction = hash < 0x80000000 ? -1 : 1;
            }
            output[offset + channel] += direction;
        }
    }
    return output;
};
