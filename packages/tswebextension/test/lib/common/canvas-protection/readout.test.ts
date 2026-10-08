import { describe, expect, test } from 'vitest';

import { isCanvasSizeProtected, paintNoisedPixels } from '../../../../src/lib/common/canvas-protection/readout';

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

describe('painting of noised export pixels', () => {
    test('paints only changed pixels, in their noised opaque color', () => {
        const width = 8;
        const original = new Uint8ClampedArray(width * 2 * 4);
        for (let pixel = 0; pixel < width * 2; pixel += 1) {
            original.set([100, 110, 120, pixel % 2 === 0 ? 255 : 128], pixel * 4);
        }
        const noised = original.slice();
        noised[2 * 4] += 1;
        noised[(width + 4) * 4 + 2] -= 1;
        const fills: [number, number, string][] = [];
        paintNoisedPixels(noised, original, width, (x, y, color) => { fills.push([x, y, color]); });
        expect(fills).toEqual([[2, 0, 'rgb(101,110,120)'], [4, 1, 'rgb(100,110,119)']]);
    });
});
