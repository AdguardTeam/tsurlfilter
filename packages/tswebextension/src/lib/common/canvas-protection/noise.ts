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
    state[1] += state[3] + intrinsics.floor(sum / UINT32_RANGE);
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
    state[5] += state[7] + intrinsics.floor(sum / UINT32_RANGE);
    state[4] = sum;
    low = state[6];
    state[6] = (low << 16) | (state[7] >>> 16);
    state[7] = (state[7] << 16) | (low >>> 16);
    state[6] ^= state[4];
    state[7] ^= state[5];

    sum = state[0] + state[6];
    state[1] += state[7] + intrinsics.floor(sum / UINT32_RANGE);
    state[0] = sum;
    low = state[6];
    state[6] = (low << 21) | (state[7] >>> 11);
    state[7] = (state[7] << 21) | (low >>> 11);
    state[6] ^= state[0];
    state[7] ^= state[1];

    sum = state[4] + state[2];
    state[5] += state[3] + intrinsics.floor(sum / UINT32_RANGE);
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
    const key0 = readWord(key, 0);
    const key1 = readWord(key, 4);
    const key2 = readWord(key, 8);
    const key3 = readWord(key, 12);
    const state = new intrinsics.Uint32Array(8);
    state[0] = key0 ^ 0x70736575;
    state[1] = key1 ^ 0x736f6d65;
    state[2] = key2 ^ 0x6e646f6d;
    state[3] = key3 ^ 0x646f7261;
    state[4] = key0 ^ 0x6e657261;
    state[5] = key1 ^ 0x6c796765;
    state[6] = key2 ^ 0x79746573;
    state[7] = key3 ^ 0x74656462;
    const inputLength = intrinsics.apply(intrinsics.typedLength, input, []) as number;
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
 * Draws a deterministic unsigned word from a domain-separated pixel message.
 *
 * @param seed The site key.
 * @param input Fixed-format coordinates, original RGB and rejection counter.
 * @param domain Selection, channel or direction domain.
 *
 * @returns The low uint32 word of the keyed digest.
 */
const drawWord = (seed: Uint8Array, input: Uint8Array, domain: number): number => {
    input[0] = domain;
    const state = sipHashState(seed, input);
    return (state[0] ^ state[2] ^ state[4] ^ state[6]) >>> 0;
};

/**
 * Selects a sparse, pointwise adjustment from original coordinates and RGB.
 * Separate draws isolate selection, channel and direction. Rejecting the lone
 * excess uint32 value makes channel selection exactly uniform modulo three.
 *
 * @param seed The captured 16-byte site key.
 * @param x Absolute in-bounds bitmap X coordinate.
 * @param y Absolute in-bounds bitmap Y coordinate.
 * @param rgb The three original uint8 channel values.
 *
 * @returns One bounded adjustment, or undefined for an unselected pixel.
 */
export function sampleCanvasPixel(
    seed: Uint8Array,
    x: number,
    y: number,
    rgb: readonly [number, number, number],
): PixelNoise | undefined {
    // The counter is zero except for deterministic retries of the channel draw.
    const input = new intrinsics.Uint8Array(16);
    const view = new intrinsics.DataView(intrinsics.apply(intrinsics.typedBuffer, input, []));
    intrinsics.apply(intrinsics.setUint32, view, [1, x, true]);
    intrinsics.apply(intrinsics.setUint32, view, [5, y, true]);
    intrinsics.apply(intrinsics.typedSet, input, [rgb, 9]);
    if ((drawWord(seed, input, SELECTION_DOMAIN) & 15) !== 0) {
        return undefined;
    }
    let word = drawWord(seed, input, CHANNEL_DOMAIN);
    let counter = 0;
    while (word === 0xffffffff) {
        counter += 1;
        intrinsics.apply(intrinsics.setUint32, view, [12, counter, true]);
        word = drawWord(seed, input, CHANNEL_DOMAIN);
    }
    const channel = (word % 3) as PixelNoise['channel'];
    const value = rgb[channel];
    let delta: PixelNoise['delta'];
    if (value === 0) {
        delta = 1;
    } else if (value === 255) {
        delta = -1;
    } else {
        intrinsics.apply(intrinsics.setUint32, view, [12, 0, true]);
        delta = (drawWord(seed, input, DIRECTION_DOMAIN) & 1) === 0 ? -1 : 1;
    }
    return { channel, delta };
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
            const noise = sampleCanvasPixel(seed, readout.originX + x, readout.originY + y, [
                readout.data[offset], readout.data[offset + 1], readout.data[offset + 2],
            ]);
            if (noise) {
                readout.data[offset + noise.channel] += noise.delta;
            }
        }
    }
}
