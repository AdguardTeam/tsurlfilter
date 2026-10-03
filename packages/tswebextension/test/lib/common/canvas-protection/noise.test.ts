import { createHash } from 'node:crypto';

import { describe, expect, it } from 'vitest';

import { type CanvasReadout, type ProtectionSession } from '../../../../src/lib/common/canvas-protection/contracts';
import {
    applyCanvasNoise,
    deriveInstallationTokens,
    deriveSiteSeed,
    sampleCanvasPixel,
    sipHash24,
} from '../../../../src/lib/common/canvas-protection/noise';

const session: ProtectionSession = {
    root: '000102030405060708090a0b0c0d0e0f',
    generation: '101112131415161718191a1b1c1d1e1f',
};

// Official SipHash-2-4 byte outputs for key 00..0f and messages 00..(length - 1).
// https://github.com/veorq/SipHash/blob/master/vectors.h
const referenceVectors = [
    '310e0edd47db6f72', 'fd67dc93c539f874', '5a4fa9d909806c0d', '2d7efbd796666785',
    'b7877127e09427cf', '8da699cd64557618', 'cee3fe586e46c9cb', '37d1018bf50002ab',
    '6224939a79f5f593', 'b0e4a90bdf82009e', 'f3b9dd94c5bb5d7a', 'a7ad6b22462fb3f4',
    'fbe50e86bc8f1e75', '903d84c02756ea14', 'eef27a8e90ca23f7', 'e545be4961ca29a1',
    'db9bc2577fcc2a3f', '9447be2cf5e99a69', '9cd38d96f0b3c14b', 'bd6179a71dc96dbb',
    '98eea21af25cd6be', 'c7673b2eb0cbf2d0', '883ea3e395675393', 'c8ce5ccd8c030ca8',
    '94af49f6c650adb8', 'eab8858ade92e1bc', 'f315bb5bb835d817', 'adcf6b0763612e2f',
    'a5c91da7acaa4dde', '716595876650a2a6', '28ef495c53a387ad', '42c341d8fa92d832',
    'ce7cf2722f512771', 'e37859f94623f3a7', '381205bb1ab0e012', 'ae97a10fd434e015',
    'b4a31508beff4d31', '81396229f0907902', '4d0cf49ee5d4dcca', '5c73336a76d8bf9a',
    'd0a704536ba93e0e', '925958fcd6420cad', 'a915c29bc8067318', '952b79f3bc0aa6d4',
    'f21df2e41d4535f9', '87577519048f53a9', '10a56cf5dfcd9adb', 'eb75095ccd986cd0',
    '51a9cb9ecba312e6', '96afadfc2ce666c7', '72fe52975a4364ee', '5a1645b276d592a1',
    'b274cb8ebf87870a', '6f9bb4203de7b381', 'eaecb2a30b22a87f', '9924a43cc1315724',
    'bd838d3aafbf8db7', '0b1a2a3265d51aea', '135079a3231ce660', '932b2846e4d70666',
    'e1915f5cb1eca46c', 'f325965ca16d629f', '575ff28e60381be5', '724506eb4c328a95',
];

/**
 * Creates varied opaque RGB content, independent of a protection context.
 *
 * @param fixture Stable fixture number.
 * @param width Bitmap width.
 * @param height Bitmap height.
 *
 * @returns Unprotected RGBA bytes.
 */
const createBitmap = (fixture: number, width = 32, height = 16): Uint8ClampedArray => {
    const data = new Uint8ClampedArray(width * height * 4);
    for (let y = 0; y < height; y += 1) {
        for (let x = 0; x < width; x += 1) {
            const offset = (y * width + x) * 4;
            data[offset] = (x * 13 + y * 23 + fixture * 37) % 256;
            data[offset + 1] = (x * x + y * 17 + fixture * 11) % 256;
            data[offset + 2] = (x * 41 + y * y + fixture * 53) % 256;
            data[offset + 3] = 255;
        }
    }
    return data;
};

/**
 * Copies a rectangle, including opaque sentinel bytes outside the canvas.
 *
 * @param bitmap Original canvas bytes.
 * @param canvasWidth Original canvas width.
 * @param canvasHeight Original canvas height.
 * @param originX Absolute rectangle origin.
 * @param originY Absolute rectangle origin.
 * @param width Rectangle width.
 * @param height Rectangle height.
 *
 * @returns Independent raw readout with its absolute bitmap bounds.
 */
const createReadout = (
    bitmap: Uint8ClampedArray,
    canvasWidth = 32,
    canvasHeight = 16,
    originX = 0,
    originY = 0,
    width = canvasWidth,
    height = canvasHeight,
): CanvasReadout => {
    const data = new Uint8ClampedArray(width * height * 4);
    data.fill(255);
    for (let y = 0; y < height; y += 1) {
        for (let x = 0; x < width; x += 1) {
            const absoluteX = originX + x;
            const absoluteY = originY + y;
            if (absoluteX >= 0 && absoluteY >= 0 && absoluteX < canvasWidth && absoluteY < canvasHeight) {
                const offset = (absoluteY * canvasWidth + absoluteX) * 4;
                data.set(bitmap.subarray(offset, offset + 4), (y * width + x) * 4);
            }
        }
    }
    return {
        data, canvasWidth, canvasHeight, originX, originY, width, height, colorSpace: 'srgb',
    };
};

/**
 * Checks a protected crop against a protected full readout and native padding.
 *
 * @param full Protected full-canvas bytes.
 * @param readout Protected partial readout.
 * @param original Bytes before processing the partial readout.
 *
 * @returns Whether every pixel agrees with its expected full or native source.
 */
const cropAgrees = (full: Uint8ClampedArray, readout: CanvasReadout, original: Uint8ClampedArray): boolean => {
    for (let y = 0; y < readout.height; y += 1) {
        for (let x = 0; x < readout.width; x += 1) {
            const absoluteX = readout.originX + x;
            const absoluteY = readout.originY + y;
            const inBounds = absoluteX >= 0 && absoluteY >= 0
                && absoluteX < readout.canvasWidth && absoluteY < readout.canvasHeight;
            const offset = (y * readout.width + x) * 4;
            const source = inBounds ? full : original;
            const sourceOffset = inBounds ? (absoluteY * readout.canvasWidth + absoluteX) * 4 : offset;
            for (let channel = 0; channel < 4; channel += 1) {
                if (readout.data[offset + channel] !== source[sourceOffset + channel]) {
                    return false;
                }
            }
        }
    }
    return true;
};

// Full deterministic corpora need a larger bounded timeout on slow or emulated CI runners.
const CORPUS_TEST_TIMEOUT_MS = 30_000;

describe('canvas protection noise', () => {
    it('matches SipHash reference vectors', () => {
        const key = Uint8Array.from({ length: 16 }, (_, index) => index);
        referenceVectors.forEach((expected, length) => {
            const message = Uint8Array.from({ length }, (_, index) => index);
            expect(Buffer.from(sipHash24(key, message)).toString('hex')).toBe(expected);
        });
    });

    it('changes one eligible channel by exactly one', () => {
        const seed = deriveSiteSeed(session, 'example.com');
        let evenDecreases = 0;
        let oddIncreases = 0;
        for (let value = 0; value <= 255; value += 1) {
            const rgb = [value, value, value] as const;
            let selected = 0;
            for (let x = 0; x < 512; x += 1) {
                const noise = sampleCanvasPixel(seed, x, value, rgb);
                if (!noise) {
                    continue;
                }
                selected += 1;
                expect([0, 1, 2]).toContain(noise.channel);
                expect([-1, 1]).toContain(noise.delta);
                const result = rgb.slice();
                result[noise.channel] += noise.delta;
                expect(result.filter((channel, index) => channel !== rgb[index])).toHaveLength(1);
                expect(result[noise.channel]).toBeGreaterThanOrEqual(0);
                expect(result[noise.channel]).toBeLessThanOrEqual(255);
                if (value === 0) {
                    expect(noise.delta).toBe(1);
                } else if (value === 255) {
                    expect(noise.delta).toBe(-1);
                } else if (value % 2 === 0 && noise.delta === -1) {
                    evenDecreases += 1;
                } else if (value % 2 === 1 && noise.delta === 1) {
                    oddIncreases += 1;
                }
            }
            expect(selected).toBeGreaterThan(0);
        }
        expect(evenDecreases).toBeGreaterThan(0);
        expect(oddIncreases).toBeGreaterThan(0);

        const bitmap = createBitmap(11);
        for (let offset = 3; offset < bitmap.length; offset += 4) {
            bitmap[offset] = [0, 127, 254, 255][((offset - 3) / 4) % 4];
        }
        const readout = createReadout(bitmap);
        applyCanvasNoise(readout, seed);
        let opaqueChanges = 0;
        for (let offset = 0; offset < bitmap.length; offset += 4) {
            const changedChannels = [0, 1, 2].filter((channel) => bitmap[offset + channel]
                !== readout.data[offset + channel]);
            expect(readout.data[offset + 3]).toBe(bitmap[offset + 3]);
            if (bitmap[offset + 3] !== 255) {
                expect(changedChannels).toHaveLength(0);
            } else {
                expect(changedChannels.length).toBeLessThanOrEqual(1);
                for (const channel of changedChannels) {
                    expect(Math.abs(readout.data[offset + channel] - bitmap[offset + channel])).toBe(1);
                    opaqueChanges += 1;
                }
            }
        }
        expect(opaqueChanges).toBeGreaterThan(0);
        const nondefault = { ...createReadout(bitmap), colorSpace: 'display-p3' as const };
        applyCanvasNoise(nondefault, seed);
        expect(nondefault.data).toEqual(bitmap);
    });

    it('agrees at absolute pixels across full partial and overlapping buffers', () => {
        const seed = deriveSiteSeed(session, 'example.com');
        const rectangles = [[9, 5, 11, 7], [-3, -2, 23, 19], [17, 7, 18, 12], [0, 0, 1, 1]];
        for (let fixture = 0; fixture < 100; fixture += 1) {
            const bitmap = createBitmap(fixture);
            const original = bitmap.slice();
            const full = createReadout(bitmap);
            applyCanvasNoise(full, seed);
            expect(full.data).not.toEqual(bitmap);
            for (let repeat = 0; repeat < 20; repeat += 1) {
                const equivalentElement = createReadout(bitmap.slice());
                applyCanvasNoise(equivalentElement, deriveSiteSeed({ ...session }, 'example.com'));
                expect(Buffer.from(equivalentElement.data).equals(Buffer.from(full.data))).toBe(true);
            }
            for (const [originX, originY, width, height] of rectangles.slice().reverse()) {
                const crop = createReadout(bitmap, 32, 16, originX, originY, width, height);
                const native = crop.data.slice();
                applyCanvasNoise(crop, seed);
                expect(cropAgrees(full.data, crop, native)).toBe(true);
            }
            const differentElsewhere = bitmap.slice();
            differentElsewhere[0] ^= 255;
            const changedFull = createReadout(differentElsewhere);
            applyCanvasNoise(changedFull, seed);
            expect(changedFull.data.subarray(4)).toEqual(full.data.subarray(4));
            expect(bitmap).toEqual(original);
        }
        const wideBitmap = createBitmap(3, 1024, 2);
        const wideFull = createReadout(wideBitmap, 1024, 2);
        applyCanvasNoise(wideFull, seed);
        const wideCrop = createReadout(wideBitmap, 1024, 2, 251, 0, 527, 2);
        const native = wideCrop.data.slice();
        applyCanvasNoise(wideCrop, seed);
        expect(cropAgrees(wideFull.data, wideCrop, native)).toBe(true);
    }, CORPUS_TEST_TIMEOUT_MS);

    it('matches expected sparse density without a minimum quota', () => {
        const seed = deriveSiteSeed(session, 'uniform.example');
        const channelCounts = [0, 0, 0];
        const directionCounts = [0, 0];
        let selected = 0;
        const pixels = 512 * 256;
        for (let y = 0; y < 256; y += 1) {
            for (let x = 0; x < 512; x += 1) {
                const noise = sampleCanvasPixel(seed, x, y, [126, 127, 128]);
                if (noise) {
                    selected += 1;
                    channelCounts[noise.channel] += 1;
                    directionCounts[noise.delta === -1 ? 0 : 1] += 1;
                }
            }
        }
        // Six standard deviations bound deterministic corpus checks without fixing a per-image quota.
        const expected = pixels / 16;
        expect(Math.abs(selected - expected)).toBeLessThan(6 * Math.sqrt(expected * (15 / 16)));
        for (const count of channelCounts) {
            expect(Math.abs(count - selected / 3)).toBeLessThan(6 * Math.sqrt(selected * (2 / 9)));
        }
        for (const count of directionCounts) {
            expect(Math.abs(count - selected / 2)).toBeLessThan(6 * Math.sqrt(selected / 4));
        }
        expect(selected).toBeGreaterThan(0);
        expect(selected).toBeLessThan(pixels);

        let unchangedTinyImages = 0;
        for (let fixture = 0; fixture < 100; fixture += 1) {
            const bitmap = createBitmap(fixture, 1, 1);
            const readout = createReadout(bitmap, 1, 1);
            applyCanvasNoise(readout, seed);
            if (readout.data.every((value, index) => value === bitmap[index])) {
                unchangedTinyImages += 1;
            }
        }
        expect(unchangedTinyImages).toBeGreaterThan(0);
    });

    it('keeps the cost of a 1280×720 readout within budget', () => {
        const seed = deriveSiteSeed(session, 'budget.example');
        const bitmap = createBitmap(1, 1280, 720);
        let best = Infinity;
        for (let run = 0; run < 5; run += 1) {
            const readout = createReadout(bitmap, 1280, 720);
            const start = performance.now();
            applyCanvasNoise(readout, seed);
            best = Math.min(best, performance.now() - start);
        }
        // One keyed hash per row and a mixer per pixel take a few milliseconds.
        // A keyed hash per pixel takes over 200 ms, which makes per-frame readouts unusable.
        expect(best).toBeLessThan(50);
    });

    it('derives installation tokens from the root alone', () => {
        const tokens = deriveInstallationTokens(session);
        expect(new Set(Object.values(tokens)).size).toBe(3);
        Object.values(tokens).forEach((token) => expect(token).toMatch(/^[0-9a-f]{16}$/));
        expect(deriveInstallationTokens({ ...session, generation: 'another generation' })).toEqual(tokens);
        const other = deriveInstallationTokens({ ...session, root: 'f0e0d0c0b0a090807060504030201000' });
        Object.values(other).forEach((token) => expect(Object.values(tokens)).not.toContain(token));
    });

    it('changes representative hashes across one hundred site generation contexts', () => {
        const bitmap = createBitmap(53, 64, 32);
        const nativeHash = createHash('sha256').update(bitmap).digest('hex');
        const hashes = new Set<string>();
        for (let scope = 0; scope < 100; scope += 1) {
            const capturedSession = {
                ...session,
                generation: scope < 50 ? session.generation : scope.toString(16).padStart(32, '0'),
            };
            const siteKey = scope < 50 ? `site-${scope}.example` : 'example.com';
            const seed = deriveSiteSeed(capturedSession, siteKey);
            expect(seed).toHaveLength(16);
            expect(deriveSiteSeed({ ...capturedSession }, siteKey)).toEqual(seed);
            const first = createReadout(bitmap, 64, 32);
            const second = createReadout(bitmap, 64, 32);
            applyCanvasNoise(first, seed);
            applyCanvasNoise(second, deriveSiteSeed(capturedSession, siteKey));
            expect(second.data).toEqual(first.data);
            const hash = createHash('sha256').update(first.data).digest('hex');
            expect(hash).not.toBe(nativeHash);
            expect(hashes.has(hash)).toBe(false);
            hashes.add(hash);
        }
        expect(hashes.size).toBe(100);
        expect(deriveSiteSeed({ ...session, generation: 'é' }, 'a'))
            .not.toEqual(deriveSiteSeed({ ...session, generation: 'éa' }, ''));
        expect(deriveSiteSeed({ ...session, root: 'f0e0d0c0b0a090807060504030201000' }, 'example.com'))
            .not.toEqual(deriveSiteSeed(session, 'example.com'));
    }, CORPUS_TEST_TIMEOUT_MS);
});
