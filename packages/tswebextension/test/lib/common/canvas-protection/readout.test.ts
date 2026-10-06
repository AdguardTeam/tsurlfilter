import { describe, expect, test } from 'vitest';

import { isCanvasSizeProtected, writeNoisedPixels } from '../../../../src/lib/common/canvas-protection/readout';

describe('original canvas protection size domain', () => {
    test.each<[number, number, boolean]>([
        [0, 0, true],
        [32767, 1, true],
        [1, 32767, true],
        [32768, 1, false],
        [1, 32768, false],
        [16384, 16384, true],
        [16385, 16384, false],
        [16384, 16385, false],
    ])('classifies %s×%s with the inclusive shared attribute rule', (width, height, expected) => {
        expect(isCanvasSizeProtected(width, height)).toBe(expected);
    });
});

describe('writes of noised export pixels', () => {
    const WIDTH = 64;
    const HEIGHT = 8;

    /**
     * Builds pixels with the given alpha per pixel and noise on every 16th opaque pixel.
     *
     * @param alpha Alpha of the pixel at X, Y.
     *
     * @returns Original and noised pixels.
     */
    const createPixels = (alpha: (x: number, y: number) => number): [Uint8ClampedArray, Uint8ClampedArray] => {
        const original = new Uint8ClampedArray(WIDTH * HEIGHT * 4);
        for (let y = 0; y < HEIGHT; y += 1) {
            for (let x = 0; x < WIDTH; x += 1) {
                original.set([100, 100, 100, alpha(x, y)], (y * WIDTH + x) * 4);
            }
        }
        const noised = original.slice();
        for (let pixel = 0; pixel < WIDTH * HEIGHT; pixel += 16) {
            if (noised[pixel * 4 + 3] === 255) {
                noised[pixel * 4] += 1;
            }
        }
        return [original, noised];
    };

    /**
     * Records the rectangles a write plan produces.
     *
     * @param original Pixels before the noise.
     * @param noised Pixels after the noise.
     *
     * @returns Written rectangles.
     */
    const plan = (original: Uint8ClampedArray, noised: Uint8ClampedArray): number[][] => {
        const writes: number[][] = [];
        writeNoisedPixels(noised, original, WIDTH, HEIGHT, (...rect) => { writes.push(rect); });
        return writes;
    };

    /**
     * Lists the pixels covered by the writes.
     *
     * @param writes Written rectangles.
     *
     * @returns Covered pixel indexes.
     */
    const covered = (writes: number[][]): Set<number> => new Set(writes.flatMap(([x, y, width, height]) => (
        Array.from({ length: width * height }, (_, index) => (
            (y + Math.floor(index / width)) * WIDTH + x + (index % width)
        ))
    )));

    test('writes each row of an opaque copy as one run', () => {
        expect(plan(...createPixels(() => 255))).toEqual(Array.from({ length: HEIGHT }, (_, y) => [0, y, WIDTH, 1]));
    });

    test('writes rows of a mostly opaque copy as runs', () => {
        const writes = plan(...createPixels((x) => (x === 0 ? 0 : 255)));
        expect(writes).toEqual(Array.from({ length: HEIGHT }, (_, y) => [1, y, WIDTH - 1, 1]));
    });

    test('writes only changed pixels when opacity alternates', () => {
        const [original, noised] = createPixels((x) => (x % 2 === 0 ? 255 : 128));
        const writes = plan(original, noised);
        const changed = new Set(Array.from({ length: WIDTH * HEIGHT }, (_, pixel) => pixel)
            .filter((pixel) => noised[pixel * 4] !== original[pixel * 4]));
        expect(writes.length).toBe(changed.size);
        expect(covered(writes)).toEqual(changed);
    });
});
