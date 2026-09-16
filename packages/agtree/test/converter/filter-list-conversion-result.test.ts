import { describe, expect, test } from 'vitest';

import { ProductCode } from '../../src/compatibility-tables';
import { FilterListConversionResult } from '../../src/converter/filter-list-conversion-result';

describe('FilterListConversionResult', () => {
    test('empty result', () => {
        const r = FilterListConversionResult.empty(ProductCode.Adg);
        expect(r.converted).toBe('');
        expect(r.product).toBe(ProductCode.Adg);
        expect(r.isConverted).toBe(false);
        expect(r.sourceMap).toEqual({ originals: [], conversions: {} });
        expect(r.getOriginalContent()).toBe('');
    });

    test('reverse lookups over a converted line', () => {
        // Converted content: line 0 came from an original that differs.
        const converted = "example.com#%#//scriptlet('ubo-foo')\n||b.com^";
        const r = new FilterListConversionResult(
            converted,
            ProductCode.Adg,
            { originals: ['example.com##+js(foo)'], conversions: { 0: 0 } },
            [],
            true,
        );

        expect(r.getRuleText(0)).toBe("example.com#%#//scriptlet('ubo-foo')");
        expect(r.getOriginalRuleText(0)).toBe('example.com##+js(foo)');
        expect(r.getConvertedRuleOriginal(0)).toBe('example.com##+js(foo)');

        const secondOffset = converted.indexOf('||b.com^');
        expect(r.getConvertedRuleOriginal(secondOffset)).toBeNull();
        expect(r.getOriginalRuleText(secondOffset)).toBe('||b.com^');
        expect(r.getOriginalContent()).toBe('example.com##+js(foo)\n||b.com^');
    });

    test('getRuleText returns null for a negative offset', () => {
        const r = new FilterListConversionResult(
            'a\nb',
            ProductCode.Adg,
            { originals: [], conversions: {} },
            [],
            false,
        );

        expect(r.getRuleText(-1)).toBeNull();
        expect(r.getRuleText(3)).toBeNull();
    });

    test('reconstructs originals across form-feed line breaks', () => {
        const converted = "example.com#%#//scriptlet('ubo-foo')\f||b.com^";
        const r = new FilterListConversionResult(
            converted,
            ProductCode.Adg,
            { originals: ['example.com##+js(foo)'], conversions: { 0: 0 } },
            [],
            true,
        );

        expect(r.getOriginalContent()).toBe('example.com##+js(foo)\f||b.com^');
    });

    test('getOriginalContent terminates on a malformed map pointing past EOF', () => {
        const r = new FilterListConversionResult(
            'AB',
            ProductCode.Adg,
            { originals: ['x'], conversions: { 0: 0, 2: 0 } },
            [],
            true,
        );

        expect(r.getOriginalContent()).toBe('x');
    });
});
