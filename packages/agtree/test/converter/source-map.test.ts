import { describe, expect, test } from 'vitest';

import { conversionSourceMapValidator, createEmptyConversionSourceMap } from '../../src/converter/source-map';

describe('ConversionSourceMap', () => {
    test('empty factory', () => {
        expect(createEmptyConversionSourceMap()).toEqual({ originals: [], conversions: {} });
    });

    test('accepts numeric-string keys (JSON round-trip)', () => {
        const parsed = conversionSourceMapValidator.parse({
            originals: ['a'],
            conversions: { 0: 0, 12: 0 },
        });
        expect(parsed.originals).toEqual(['a']);
        expect(parsed.conversions[0]).toBe(0);
    });

    test('rejects negative offsets', () => {
        expect(() => conversionSourceMapValidator.parse({
            originals: [],
            conversions: { '-1': 0 },
        })).toThrow();
    });
});
