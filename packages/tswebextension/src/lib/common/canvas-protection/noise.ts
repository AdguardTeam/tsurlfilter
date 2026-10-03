import { type CanvasReadout, type ProtectionSession } from './contracts';
import { canvasIntrinsics as intrinsics } from './intrinsics';

/**
 * Exactly one selected RGB channel and its bounded one-level adjustment.
 */
export interface PixelNoise {
    readonly channel: 0 | 1 | 2;
    readonly delta: -1 | 1;
}

const UINT32_RANGE = 0x100000000;
const SELECTION_DOMAIN = 1;
const CHANNEL_DOMAIN = 2;
const DIRECTION_DOMAIN = 3;
const SITE_SEED_DOMAINS = [16, 17];

/**
 * Reads a little-endian uint32 word without assuming byte-buffer alignment.
 *
 * @param bytes Message or key bytes.
 * @param offset Start of the complete four-byte word.
 *
 * @returns The unsigned word.
 */
const readWord = (bytes: Uint8Array, offset: number): number => (
    bytes[offset] | (bytes[offset + 1] << 8) | (bytes[offset + 2] << 16) | (bytes[offset + 3] << 24)
) >>> 0;

/**
 * Performs a SipRound with each uint64 represented by low/high uint32 words.
 *
 * @param state The four local compression-state words, stored low word first.
 */
/* eslint-disable prefer-destructuring -- Keep the low/high uint32 indices explicit throughout SipRound. */
const sipRound = (state: Uint32Array): void => {
    let sum = state[0] + state[2];
    state[1] += state[3] + (sum >= UINT32_RANGE ? 1 : 0);
    state[0] = sum;
    let low = state[2];
    state[2] = (low << 13) | (state[3] >>> 19);
    state[3] = (state[3] << 13) | (low >>> 19);
    state[2] ^= state[0];
    state[3] ^= state[1];
    low = state[0];
    state[0] = state[1];
    state[1] = low;

    sum = state[4] + state[6];
    state[5] += state[7] + (sum >= UINT32_RANGE ? 1 : 0);
    state[4] = sum;
    low = state[6];
    state[6] = (low << 16) | (state[7] >>> 16);
    state[7] = (state[7] << 16) | (low >>> 16);
    state[6] ^= state[4];
    state[7] ^= state[5];

    sum = state[0] + state[6];
    state[1] += state[7] + (sum >= UINT32_RANGE ? 1 : 0);
    state[0] = sum;
    low = state[6];
    state[6] = (low << 21) | (state[7] >>> 11);
    state[7] = (state[7] << 21) | (low >>> 11);
    state[6] ^= state[0];
    state[7] ^= state[1];

    sum = state[4] + state[2];
    state[5] += state[3] + (sum >= UINT32_RANGE ? 1 : 0);
    state[4] = sum;
    low = state[2];
    state[2] = (low << 17) | (state[3] >>> 15);
    state[3] = (state[3] << 17) | (low >>> 15);
    state[2] ^= state[4];
    state[3] ^= state[5];
    low = state[4];
    state[4] = state[5];
    state[5] = low;
};
/* eslint-enable prefer-destructuring */

/**
 * Computes standard SipHash-2-4, keeping compression state local to this message.
 *
 * @param key The trusted 16-byte key.
 * @param input Arbitrary message bytes.
 *
 * @returns The final state, whose four uint64 words are XORed for the digest.
 */
const sipHashState = (key: Uint8Array, input: Uint8Array): Uint32Array => {
    const state = new intrinsics.Uint32Array(8);
    const inputLength = intrinsics.apply(intrinsics.typedLength, input, []) as number;
    const key0 = readWord(key, 0);
    const key1 = readWord(key, 4);
    const key2 = readWord(key, 8);
    const key3 = readWord(key, 12);
    state[0] = key0 ^ 0x70736575;
    state[1] = key1 ^ 0x736f6d65;
    state[2] = key2 ^ 0x6e646f6d;
    state[3] = key3 ^ 0x646f7261;
    state[4] = key0 ^ 0x6e657261;
    state[5] = key1 ^ 0x6c796765;
    state[6] = key2 ^ 0x79746573;
    state[7] = key3 ^ 0x74656462;
    const completeLength = inputLength - (inputLength % 8);
    for (let offset = 0; offset < completeLength; offset += 8) {
        const low = readWord(input, offset);
        const high = readWord(input, offset + 4);
        state[6] ^= low;
        state[7] ^= high;
        sipRound(state);
        sipRound(state);
        state[0] ^= low;
        state[1] ^= high;
    }

    let low = 0;
    let high = (inputLength & 255) << 24;
    for (let offset = completeLength; offset < inputLength; offset += 1) {
        const shift = (offset - completeLength) * 8;
        if (shift < 32) {
            low |= input[offset] << shift;
        } else {
            high |= input[offset] << (shift - 32);
        }
    }
    state[6] ^= low;
    state[7] ^= high;
    sipRound(state);
    sipRound(state);
    state[0] ^= low;
    state[1] ^= high;
    state[4] ^= 255;
    for (let round = 0; round < 4; round += 1) {
        sipRound(state);
    }
    return state;
};

/**
 * Computes the standard eight-byte, little-endian SipHash-2-4 output.
 *
 * @param key The trusted 16-byte key.
 * @param input Arbitrary message bytes.
 *
 * @returns The standard 64-bit digest bytes.
 */
export function sipHash24(key: Uint8Array, input: Uint8Array): Uint8Array {
    const state = sipHashState(key, input);
    const output = new intrinsics.Uint8Array(8);
    const view = new intrinsics.DataView(intrinsics.apply(intrinsics.typedBuffer, output, []));
    intrinsics.apply(intrinsics.setUint32, view, [0, state[0] ^ state[2] ^ state[4] ^ state[6], true]);
    intrinsics.apply(intrinsics.setUint32, view, [4, state[1] ^ state[3] ^ state[5] ^ state[7], true]);
    return output;
}

/**
 * Derives a site key with independent halves from the captured browser-run root.
 * Length prefixes prevent ambiguous concatenation of UTF-8 generation/site values.
 *
 * @param session Trusted captured root in hex and independent generation.
 * @param siteKey The complete resolved hostname key.
 *
 * @returns The 16-byte key shared by every readout in this site and generation.
 */
export function deriveSiteSeed(session: ProtectionSession, siteKey: string): Uint8Array {
    const root = new intrinsics.Uint8Array(16);
    for (let index = 0; index < 16; index += 1) {
        const hex = intrinsics.apply(intrinsics.slice, session.root, [index * 2, index * 2 + 2]);
        root[index] = intrinsics.parseInt(hex, 16);
    }
    const encoder = new intrinsics.TextEncoder();
    const generation = intrinsics.apply(intrinsics.encode, encoder, [session.generation]) as Uint8Array;
    const site = intrinsics.apply(intrinsics.encode, encoder, [siteKey]) as Uint8Array;
    const generationLength = intrinsics.apply(intrinsics.typedLength, generation, []) as number;
    const siteLength = intrinsics.apply(intrinsics.typedLength, site, []) as number;
    const input = new intrinsics.Uint8Array(9 + generationLength + siteLength);
    const view = new intrinsics.DataView(intrinsics.apply(intrinsics.typedBuffer, input, []));
    intrinsics.apply(intrinsics.setUint32, view, [1, generationLength, true]);
    intrinsics.apply(intrinsics.typedSet, input, [generation, 5]);
    intrinsics.apply(intrinsics.setUint32, view, [5 + generationLength, siteLength, true]);
    intrinsics.apply(intrinsics.typedSet, input, [site, 9 + generationLength]);
    const seed = new intrinsics.Uint8Array(16);
    for (let index = 0; index < 2; index += 1) {
        input[0] = SITE_SEED_DOMAINS[index];
        intrinsics.apply(intrinsics.typedSet, seed, [sipHash24(root, input), index * 8]);
    }
    return seed;
}

/**
 * Computes the low SipHash word for the fixed sixteen-byte pixel message.
 * Scalar words avoid typed-array compression-state traffic in the pixel loop.
 *
 * @param key0 First little-endian key word.
 * @param key1 Second little-endian key word.
 * @param key2 Third little-endian key word.
 * @param key3 Fourth little-endian key word.
 * @param input Fixed-format pixel bytes.
 *
 * @returns The exact low word of the standard keyed digest.
 */
const hashPixel = (key0: number, key1: number, key2: number, key3: number, input: Uint8Array): number => {
    let v0Low = (key0 ^ 0x70736575) >>> 0;
    let v0High = (key1 ^ 0x736f6d65) >>> 0;
    let v1Low = (key2 ^ 0x6e646f6d) >>> 0;
    let v1High = (key3 ^ 0x646f7261) >>> 0;
    let v2Low = (key0 ^ 0x6e657261) >>> 0;
    let v2High = (key1 ^ 0x6c796765) >>> 0;
    let v3Low = (key2 ^ 0x79746573) >>> 0;
    let v3High = (key3 ^ 0x74656462) >>> 0;
    let messageLow = 0;
    let messageHigh = 0;
    for (let round = 0; round < 10; round += 1) {
        if (round < 6 && round % 2 === 0) {
            messageLow = round === 4 ? 0 : readWord(input, round * 4);
            messageHigh = round === 4 ? 0x10000000 : readWord(input, round * 4 + 4);
            v3Low ^= messageLow;
            v3High ^= messageHigh;
        }
        let sum = (v0Low >>> 0) + (v1Low >>> 0);
        v0High = (v0High + v1High + (sum >= UINT32_RANGE ? 1 : 0)) >>> 0;
        v0Low = sum >>> 0;
        let low = v1Low;
        v1Low = (low << 13) | (v1High >>> 19);
        v1High = (v1High << 13) | (low >>> 19);
        v1Low ^= v0Low;
        v1High ^= v0High;
        low = v0Low;
        v0Low = v0High;
        v0High = low;

        sum = (v2Low >>> 0) + (v3Low >>> 0);
        v2High = (v2High + v3High + (sum >= UINT32_RANGE ? 1 : 0)) >>> 0;
        v2Low = sum >>> 0;
        low = v3Low;
        v3Low = (low << 16) | (v3High >>> 16);
        v3High = (v3High << 16) | (low >>> 16);
        v3Low ^= v2Low;
        v3High ^= v2High;

        sum = (v0Low >>> 0) + (v3Low >>> 0);
        v0High = (v0High + v3High + (sum >= UINT32_RANGE ? 1 : 0)) >>> 0;
        v0Low = sum >>> 0;
        low = v3Low;
        v3Low = (low << 21) | (v3High >>> 11);
        v3High = (v3High << 21) | (low >>> 11);
        v3Low ^= v0Low;
        v3High ^= v0High;

        sum = (v2Low >>> 0) + (v1Low >>> 0);
        v2High = (v2High + v1High + (sum >= UINT32_RANGE ? 1 : 0)) >>> 0;
        v2Low = sum >>> 0;
        low = v1Low;
        v1Low = (low << 17) | (v1High >>> 15);
        v1High = (v1High << 17) | (low >>> 15);
        v1Low ^= v2Low;
        v1High ^= v2High;
        low = v2Low;
        v2Low = v2High;
        v2High = low;
        if (round < 6 && round % 2 === 1) {
            v0Low ^= messageLow;
            v0High ^= messageHigh;
            if (round === 5) {
                v2Low ^= 255;
            }
        }
    }
    return (v0Low ^ v1Low ^ v2Low ^ v3Low) >>> 0;
};

/**
 * Reuses private per-readout buffers without sharing state across nested readouts.
 * The byte format and every SipHash domain remain identical to scalar sampling.
 *
 * @param seed Captured site key.
 *
 * @returns A packed channel/direction code, or zero for an unselected pixel.
 */
const createPixelSampler = (seed: Uint8Array): (
x: number, y: number, red: number, green: number, blue: number,
) => number => {
    const input = new intrinsics.Uint8Array(16);
    const key0 = readWord(seed, 0);
    const key1 = readWord(seed, 4);
    const key2 = readWord(seed, 8);
    const key3 = readWord(seed, 12);
    const draw = (domain: number): number => {
        input[0] = domain;
        return hashPixel(key0, key1, key2, key3, input);
    };
    return (x, y, red, green, blue): number => {
        input[1] = x;
        input[2] = x >>> 8;
        input[3] = x >>> 16;
        input[4] = x >>> 24;
        input[5] = y;
        input[6] = y >>> 8;
        input[7] = y >>> 16;
        input[8] = y >>> 24;
        input[9] = red;
        input[10] = green;
        input[11] = blue;
        input[12] = 0;
        input[13] = 0;
        input[14] = 0;
        input[15] = 0;
        if ((draw(SELECTION_DOMAIN) & 15) !== 0) {
            return 0;
        }
        let word = draw(CHANNEL_DOMAIN);
        let counter = 0;
        while (word === 0xffffffff) {
            counter += 1;
            input[12] = counter;
            input[13] = counter >>> 8;
            input[14] = counter >>> 16;
            input[15] = counter >>> 24;
            word = draw(CHANNEL_DOMAIN);
        }
        const channel = word % 3;
        let value = red;
        if (channel === 1) {
            value = green;
        } else if (channel === 2) {
            value = blue;
        }
        if (value === 0) {
            return channel + 1;
        }
        if (value === 255) {
            return channel + 4;
        }
        input[12] = 0;
        input[13] = 0;
        input[14] = 0;
        input[15] = 0;
        return channel + ((draw(DIRECTION_DOMAIN) & 1) === 0 ? 4 : 1);
    };
};

/**
 * Selects the same sparse pointwise adjustment as the reusable readout sampler.
 *
 * @param seed Captured site key.
 * @param x Absolute in-bounds bitmap X coordinate.
 * @param y Absolute in-bounds bitmap Y coordinate.
 * @param rgb Original uint8 channel values.
 *
 * @returns One bounded adjustment, or undefined for an unselected pixel.
 */
export function sampleCanvasPixel(
    seed: Uint8Array,
    x: number,
    y: number,
    rgb: readonly [number, number, number],
): PixelNoise | undefined {
    const code = createPixelSampler(seed)(x, y, rgb[0], rgb[1], rgb[2]);
    return code === 0 ? undefined : { channel: ((code - 1) % 3) as PixelNoise['channel'], delta: code <= 3 ? 1 : -1 };
}

/**
 * Adjusts an owned uint8 sRGB readout without touching padding or nonopaque pixels.
 * Each sample uses absolute coordinates and the original RGB of that pixel.
 *
 * @param readout Independent returned or scratch bytes and original canvas bounds.
 * @param seed The captured site key shared with other readout APIs.
 */
export function applyCanvasNoise(readout: CanvasReadout, seed: Uint8Array): void {
    if (readout.colorSpace !== 'srgb') {
        return;
    }
    const sample = createPixelSampler(seed);
    const startX = intrinsics.max(0, -readout.originX);
    const startY = intrinsics.max(0, -readout.originY);
    const endX = intrinsics.min(readout.width, readout.canvasWidth - readout.originX);
    const endY = intrinsics.min(readout.height, readout.canvasHeight - readout.originY);
    for (let y = startY; y < endY; y += 1) {
        for (let x = startX; x < endX; x += 1) {
            const offset = (y * readout.width + x) * 4;
            if (readout.data[offset + 3] !== 255) {
                continue;
            }
            const code = sample(
                readout.originX + x,
                readout.originY + y,
                readout.data[offset],
                readout.data[offset + 1],
                readout.data[offset + 2],
            );
            if (code !== 0) {
                readout.data[offset + ((code - 1) % 3)] += code <= 3 ? 1 : -1;
            }
        }
    }
}
