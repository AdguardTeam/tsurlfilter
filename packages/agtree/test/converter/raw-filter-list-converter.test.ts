import { describe, expect, test } from 'vitest';

import { ProductCode } from '../../src/compatibility-tables';
import { RawFilterListConverter } from '../../src/converter/raw-filter-list';

describe('RawFilterListConverter.convertToAdg', () => {
    test('returns input unchanged when nothing needs conversion', () => {
        const input = ['||example.com^', '||example.org^'].join('\n');
        const r = RawFilterListConverter.convertToAdg(input);
        expect(r.converted).toBe(input);
        expect(r.isConverted).toBe(false);
        expect(r.product).toBe(ProductCode.Adg);
        expect(r.sourceMap).toEqual({ originals: [], conversions: {} });
        expect(r.getOriginalContent()).toBe(input);
    });

    test('converts scriptlet rules and builds a source map', () => {
        const input = ['example.com##+js(foo)', 'example.com#$#bar;baz'].join('\n');
        const r = RawFilterListConverter.convertToAdg(input);
        expect(r.converted).toBe([
            "example.com#%#//scriptlet('ubo-foo')",
            "example.com#%#//scriptlet('abp-bar')",
            "example.com#%#//scriptlet('abp-baz')",
        ].join('\n'));
        expect(r.isConverted).toBe(true);
        expect(r.getOriginalContent()).toBe(input);
    });

    test('preserves CRLF and no-trailing-newline multi-line expansion', () => {
        const input = 'example.com##+js(foo)\r\nexample.com#$#bar;baz';
        const r = RawFilterListConverter.convertToAdg(input);
        expect(r.converted).toBe([
            "example.com#%#//scriptlet('ubo-foo')\r\n",
            "example.com#%#//scriptlet('abp-bar')\n",
            "example.com#%#//scriptlet('abp-baz')",
        ].join(''));
        expect(r.getOriginalContent()).toBe(input);
    });

    test('empty input yields an empty result', () => {
        const r = RawFilterListConverter.convertToAdg('');
        expect(r.converted).toBe('');
        expect(r.isConverted).toBe(false);
    });
});

describe('RawFilterListConverter (regression)', () => {
    test('convertToAdg should leave non-affected filter lists as is', () => {
        const filterListContent = [
            '! Title: Foo',
            '! Description: Bar',
            '! Expires: 1 day',
            '! Homepage: https://example.com',
            '! Version: 1',
            '! License: https://example.com/license',
            '||example.com^$script',
        ].join('\n');

        const convertedFilterList = RawFilterListConverter.convertToAdg(filterListContent);

        expect(convertedFilterList.isConverted).toBe(false);
        expect(convertedFilterList.converted).toBe(filterListContent);
    });

    test('convertToAdg should convert filter lists to AdGuard syntax', () => {
        // We don't need to test all possible rule types here, since we already
        // have tests for RuleConverter.convertToAdg
        const filterListContent = [
            '! Title: Foo',
            '! Description: Bar',
            '! Expires: 1 day',
            '! Homepage: https://example.com',
            '! Version: 1',
            '! License: https://example.com/license',
            '||example.com^$script',
            // ---
            '||googletagservices.com/test.js$domain=test.com,redirect=googletagservices_gpt.js',
            '||delivery.tf1.fr/pub$media,rewrite=abp-resource:blank-mp3,domain=tf1.fr',
            'example.com#$#abp-snippet1 arg0 arg1; abp-snippet2 arg0 arg1',
            '##^script:has-text(ad)',
        ].join('\n');

        const expectedFilterListContent = [
            '! Title: Foo',
            '! Description: Bar',
            '! Expires: 1 day',
            '! Homepage: https://example.com',
            '! Version: 1',
            '! License: https://example.com/license',
            '||example.com^$script',
            // ---
            '||googletagservices.com/test.js$domain=test.com,redirect=googletagservices-gpt',
            '||delivery.tf1.fr/pub$media,redirect=noopmp3-0.1s,domain=tf1.fr',
            "example.com#%#//scriptlet('abp-snippet1', 'arg0', 'arg1')",
            "example.com#%#//scriptlet('abp-snippet2', 'arg0', 'arg1')",
            '$$script:contains(ad)',
        ].join('\n');

        const convertedFilterList = RawFilterListConverter.convertToAdg(filterListContent);

        expect(convertedFilterList.isConverted).toBe(true);
        expect(convertedFilterList.converted).toBe(expectedFilterListContent);
    });

    test('Tolerant mode should work correctly', () => {
        const filterListContent = [
            '! Title: Foo',
            // Invalid rule because `:has-text()` provided without argument
            '##^body:has-text(',
            // Should be converted
            '||example.com^$3p',
        ].join('\n');

        // Expected tolerantly converted filter list
        const expectedFilterListContent = [
            '! Title: Foo',
            '##^body:has-text(', // Left as is
            '||example.com^$third-party', // Converted
        ].join('\n');

        // Without tolerant mode, the whole filter list should fail
        expect(() => RawFilterListConverter.convertToAdg(filterListContent, { tolerant: false })).toThrow();

        // With tolerant mode, the whole filter list should be converted
        const tolerant = () => RawFilterListConverter.convertToAdg(filterListContent, { tolerant: true });
        expect(tolerant).not.toThrow();

        // The rule should be left as is
        expect(tolerant().converted).toBe(expectedFilterListContent);
    });

    test('convertToAdg should convert a modifier on a rule followed by another rule', () => {
        // Regression: the `$` separator of the first rule must be detected even
        // though a line break (belonging to the next rule) follows `$3p`.
        // Previously the modifier probe used the chunk-wide token count, saw the
        // line break, rejected the separator, and left `$3p` in the pattern.
        const filterListContent = [
            '||a^$3p',
            '||b^$script',
        ].join('\n');

        const expectedFilterListContent = [
            '||a^$third-party',
            '||b^$script',
        ].join('\n');

        const convertedFilterList = RawFilterListConverter.convertToAdg(filterListContent);

        expect(convertedFilterList.isConverted).toBe(true);
        expect(convertedFilterList.converted).toBe(expectedFilterListContent);
    });
});

describe('RawFilterListConverter parity with tsurlfilter FilterList', () => {
    test.each([
        [
            '||example.org^\nexample.com##.ad\nexample.com#@#.ad\n'
            + 'invalid rule syntax\n! comment\n'
            + '||track.com^$third-party,domain=a.com|~b.com\n',
        ],
        ['||a.com^\r\n||b.com^\n||c.com^'],
        ['example.com#$#bar;baz\nexample.com#$#bar;baz'],
        ['example.com##+js(foo)\r\nexample.com#$#bar;baz\r\n'],
    ])('getOriginalContent() is byte-identical for %j', (input) => {
        const r = RawFilterListConverter.convertToAdg(input);
        expect(r.getOriginalContent()).toBe(input);
    });
});
