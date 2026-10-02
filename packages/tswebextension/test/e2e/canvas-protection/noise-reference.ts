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
 * Constructs the expected sparse source bitmap without a protected canvas readout.
 *
 * @param source Original source pixels at the native snapshot boundary.
 * @param seed Captured fixture site key.
 *
 * @returns Independently protected source bytes with native alpha and nonopaque pixels.
 */
export const referenceSourceNoise = (source: ImageData, seed: Uint8Array): Uint8ClampedArray => {
    const output = new Uint8ClampedArray(source.data);
    const message = new Uint8Array(16);
    const view = new DataView(message.buffer);
    const draw = (domain: number): number => {
        message[0] = domain;
        return Number(referenceSipHash(seed, message) & 0xffffffffn);
    };
    for (let y = 0; y < source.height; y += 1) {
        for (let x = 0; x < source.width; x += 1) {
            const offset = (y * source.width + x) * 4;
            if (source.data[offset + 3] !== 255) {
                continue;
            }
            view.setUint32(1, x, true);
            view.setUint32(5, y, true);
            message.set(source.data.subarray(offset, offset + 3), 9);
            view.setUint32(12, 0, true);
            if ((draw(1) & 15) !== 0) {
                continue;
            }
            let channelWord = draw(2);
            let counter = 0;
            while (channelWord === 0xffffffff) {
                counter += 1;
                view.setUint32(12, counter, true);
                channelWord = draw(2);
            }
            const channel = channelWord % 3;
            const value = source.data[offset + channel];
            view.setUint32(12, 0, true);
            let direction: number;
            if (value === 0) {
                direction = 1;
            } else if (value === 255) {
                direction = -1;
            } else {
                direction = (draw(3) & 1) === 0 ? -1 : 1;
            }
            output[offset + channel] += direction;
        }
    }
    return output;
};
