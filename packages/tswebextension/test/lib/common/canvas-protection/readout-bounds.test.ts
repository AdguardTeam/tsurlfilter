import { describe, expect, test } from 'vitest';

import { isCanvasSizeProtected } from '../../../../src/lib/common/canvas-protection/readout';

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
