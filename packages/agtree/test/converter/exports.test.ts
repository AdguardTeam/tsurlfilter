import { describe, expect, test } from 'vitest';

import * as converter from '../../src/converter';

describe('agtree converter exports', () => {
    test('exposes the new converter surface', () => {
        expect(typeof converter.RawFilterListConverter.convertToAdg).toBe('function');
        expect(typeof converter.FilterListConversionResult).toBe('function');
        expect(typeof converter.conversionSourceMapValidator.parse).toBe('function');
        expect(typeof converter.createEmptyConversionSourceMap).toBe('function');
    });
});
