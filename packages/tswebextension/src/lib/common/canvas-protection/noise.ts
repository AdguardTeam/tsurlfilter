// Part of the engine injected into pages: plain functions instead of a static class keep it small,
// see engine-entry.ts.
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
const ROW_DOMAIN = 4;
const SITE_SEED_DOMAINS = [16, 17];
const INSTALLATION_DOMAINS = [32, 33, 34];
const HEX_DIGITS = '0123456789abcdef';
const { imul } = intrinsics;
const LITTLE_ENDIAN = new intrinsics.Uint8Array(
    intrinsics.apply(intrinsics.typedBuffer, new intrinsics.Uint32Array([1]), []),
)[0] === 1;

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
 * Decodes the captured browser-run root.
 *
 * @param session Trusted captured root in hex.
 *
 * @returns The 16-byte root key.
 */
const parseRoot = (session: ProtectionSession): Uint8Array => {
    const root = new intrinsics.Uint8Array(16);
    for (let index = 0; index < 16; index += 1) {
        const hex = intrinsics.apply(intrinsics.slice, session.root, [index * 2, index * 2 + 2]);
        root[index] = intrinsics.parseInt(hex, 16);
    }
    return root;
};

/**
 * Private strings by which engine instances of one browser run recognize each other's wrappers.
 */
export interface InstallationTokens {
    readonly probe: string;
    readonly adopt: string;
    readonly reply: string;
}

/**
 * Derives the installation tokens from the root alone, so every document of the
 * browser run agrees on them whatever its site or policy.
 *
 * @param session Trusted captured root in hex.
 *
 * @returns Three unrelated strings a page cannot derive.
 */
export function deriveInstallationTokens(session: ProtectionSession): InstallationTokens {
    const root = parseRoot(session);
    const input = new intrinsics.Uint8Array(1);
    const token = (domain: number): string => {
        input[0] = domain;
        const digest = sipHash24(root, input);
        let text = '';
        for (let index = 0; index < 8; index += 1) {
            text += HEX_DIGITS[digest[index] >>> 4] + HEX_DIGITS[digest[index] & 15];
        }
        return text;
    };
    return {
        probe: token(INSTALLATION_DOMAINS[0]),
        adopt: token(INSTALLATION_DOMAINS[1]),
        reply: token(INSTALLATION_DOMAINS[2]),
    };
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
    const root = parseRoot(session);
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
 * Derives the two mixer key words of one absolute bitmap row from the site key.
 * One keyed SipHash per row keeps rows independent and the site key unrecoverable.
 *
 * @param seed Captured site key.
 * @param y Absolute bitmap Y coordinate.
 * @param input Private five-byte row message buffer.
 * @param rowKey Private two-word output.
 */
const deriveRowKey = (seed: Uint8Array, y: number, input: Uint8Array, rowKey: Uint32Array): void => {
    input[0] = ROW_DOMAIN;
    input[1] = y;
    input[2] = y >>> 8;
    input[3] = y >>> 16;
    input[4] = y >>> 24;
    const state = sipHashState(seed, input);
    rowKey[0] = state[0] ^ state[2] ^ state[4] ^ state[6];
    rowKey[1] = state[1] ^ state[3] ^ state[5] ^ state[7];
};

/**
 * Selects the sparse adjustment for one opaque pixel from its row key, X and original RGB.
 * A 32-bit multiply-xorshift mixer replaces a per-pixel keyed hash: the row key is
 * already a keyed digest, and the pixel only needs well-distributed selection bits.
 *
 * @param key0 First row key word.
 * @param key1 Second row key word.
 * @param x Absolute bitmap X coordinate.
 * @param rgb Original red, green and blue values as `red | green << 8 | blue << 16`.
 *
 * @returns A packed channel/direction code, or zero for an unselected pixel.
 */
const selectPixelNoise = (key0: number, key1: number, x: number, rgb: number): number => {
    let hash = imul(rgb ^ key0, 0x9e3779b1) ^ imul(x ^ key1, 0x85ebca6b);
    hash ^= hash >>> 16;
    hash = imul(hash, 0x21f0aaad);
    hash ^= hash >>> 15;
    hash = imul(hash, 0x735a2d97);
    hash ^= hash >>> 15;
    if ((hash & 15) !== 0) {
        return 0;
    }
    const channel = (((hash >>> 4) & 0xffff) * 3) >>> 16;
    const value = (rgb >>> (channel * 8)) & 255;
    if (value === 0) {
        return channel + 1;
    }
    if (value === 255) {
        return channel + 4;
    }
    return channel + (hash >>> 31 === 0 ? 4 : 1);
};

/**
 * Selects the same sparse pointwise adjustment as the readout loop.
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
    const rowKey = new intrinsics.Uint32Array(2);
    deriveRowKey(seed, y, new intrinsics.Uint8Array(5), rowKey);
    const code = selectPixelNoise(rowKey[0], rowKey[1], x, rgb[0] | (rgb[1] << 8) | (rgb[2] << 16));
    return code === 0 ? undefined : { channel: ((code - 1) % 3) as PixelNoise['channel'], delta: code <= 3 ? 1 : -1 };
}

/**
 * Adjusts an owned uint8 sRGB readout without touching padding or nonopaque pixels.
 * Each sample uses absolute coordinates and the original RGB of that pixel.
 * Pixels are read as little-endian words, so big-endian platforms keep native readouts.
 *
 * @param readout Independent returned or scratch bytes and original canvas bounds.
 * @param seed The captured site key shared with other readout APIs.
 */
export function applyCanvasNoise(readout: CanvasReadout, seed: Uint8Array): void {
    if (readout.colorSpace !== 'srgb' || !LITTLE_ENDIAN) {
        return;
    }
    // ImageData owns its buffer from offset zero, one word per RGBA pixel.
    const pixels = new intrinsics.Uint32Array(
        intrinsics.apply(intrinsics.typedBuffer, readout.data, []),
        0,
        readout.width * readout.height,
    );
    const input = new intrinsics.Uint8Array(5);
    const rowKey = new intrinsics.Uint32Array(2);
    const startX = intrinsics.max(0, -readout.originX);
    const startY = intrinsics.max(0, -readout.originY);
    const endX = intrinsics.min(readout.width, readout.canvasWidth - readout.originX);
    const endY = intrinsics.min(readout.height, readout.canvasHeight - readout.originY);
    for (let y = startY; y < endY; y += 1) {
        deriveRowKey(seed, readout.originY + y, input, rowKey);
        const key0 = rowKey[0];
        const key1 = rowKey[1];
        let index = y * readout.width + startX;
        for (let x = startX; x < endX; x += 1, index += 1) {
            const pixel = pixels[index];
            if (pixel >>> 24 !== 255) {
                continue;
            }
            const code = selectPixelNoise(key0, key1, readout.originX + x, pixel & 0xffffff);
            if (code !== 0) {
                pixels[index] = pixel + (code <= 3 ? 1 : -1) * (1 << (((code - 1) % 3) * 8));
            }
        }
    }
}
