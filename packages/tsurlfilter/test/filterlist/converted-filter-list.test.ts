import { describe, expect, it } from 'vitest';

import { ConvertedFilterList } from '../../src/filterlist/converted-filter-list';

describe('ConvertedFilterList', () => {
    it('should return original filter list unchanged when no conversion needed', () => {
        const original = [
            '||example.com^',
            '||example.org^',
        ].join('\n');
        const list = new ConvertedFilterList(original);

        expect(list.getContent()).toEqual(original);
        expect(list.getOriginalContent()).toEqual(original);
    });

    it('should convert known scriptlet rules and retain original rules', () => {
        const original = [
            'example.com##+js(foo)',
            'example.com#$#bar;baz',
        ].join('\n');

        const list = new ConvertedFilterList(original);

        const converted = list.getContent();
        expect(converted).toBe([
            "example.com#%#//scriptlet('ubo-foo')",
            "example.com#%#//scriptlet('abp-bar')",
            "example.com#%#//scriptlet('abp-baz')",
        ].join('\n'));

        const restored = list.getOriginalContent();
        expect(restored).toEqual(original);
    });

    it('should convert known scriptlet rules and retain original rules 1', () => {
        const original = [
            'example.com##+js(foo)',
            'example.com#$#bar;baz',
            '',
        ].join('\n');

        const list = new ConvertedFilterList(original);

        const converted = list.getContent();
        expect(converted).toBe([
            "example.com#%#//scriptlet('ubo-foo')",
            "example.com#%#//scriptlet('abp-bar')",
            "example.com#%#//scriptlet('abp-baz')",
            '',
        ].join('\n'));

        const restored = list.getOriginalContent();
        expect(restored).toEqual(original);
    });

    it('should convert known scriptlet rules and retain original rules', () => {
        const original = [
            'example.com##+js(foo)',
            'example.com#$#bar;baz',
            '',
        ].join('\r\n');

        const list = new ConvertedFilterList(original);

        const converted = list.getContent();
        expect(converted).toBe([
            "example.com#%#//scriptlet('ubo-foo')",
            "example.com#%#//scriptlet('abp-bar')",
            "example.com#%#//scriptlet('abp-baz')",
            '',
        ].join('\r\n'));

        const restored = list.getOriginalContent();
        expect(restored).toEqual(original);
    });

    // mixed newlines
    it('should convert known scriptlet rules and retain original rules', () => {
        const original = [
            'example.com##+js(foo)\r\n',
            'example.com#$#bar;baz\n',
            'example.com##+js(bar)\r\n',
        ].join('');

        const list = new ConvertedFilterList(original);

        const converted = list.getContent();
        expect(converted).toBe([
            "example.com#%#//scriptlet('ubo-foo')\r\n",
            "example.com#%#//scriptlet('abp-bar')\n",
            "example.com#%#//scriptlet('abp-baz')\n",
            "example.com#%#//scriptlet('ubo-bar')\r\n",
            '',
        ].join(''));

        const restored = list.getOriginalContent();
        expect(restored).toEqual(original);
    });

    // should handle duplicated rules
    it('should convert known scriptlet rules and retain original rules', () => {
        const original = [
            'example.com#$#bar;baz',
            'example.com#$#bar;baz',
        ].join('\n');

        const list = new ConvertedFilterList(original);

        const converted = list.getContent();
        expect(converted).toBe([
            "example.com#%#//scriptlet('abp-bar')",
            "example.com#%#//scriptlet('abp-baz')",
            "example.com#%#//scriptlet('abp-bar')",
            "example.com#%#//scriptlet('abp-baz')",
        ].join('\n'));

        const restored = list.getOriginalContent();
        expect(restored).toEqual(original);
    });

    // should handle duplicated rules with mixed line endings
    it('should convert known scriptlet rules and retain original rules', () => {
        const original = [
            'example.com#$#bar;baz\n',
            'example.com#$#bar;baz\r\n',
            'example.com#$#bar;baz',
        ].join('');

        const list = new ConvertedFilterList(original);

        const converted = list.getContent();
        expect(converted).toBe([
            "example.com#%#//scriptlet('abp-bar')\n",
            "example.com#%#//scriptlet('abp-baz')\n",
            "example.com#%#//scriptlet('abp-bar')\r\n",
            "example.com#%#//scriptlet('abp-baz')\r\n",
            "example.com#%#//scriptlet('abp-bar')\n",
            "example.com#%#//scriptlet('abp-baz')",
        ].join(''));

        const restored = list.getOriginalContent();
        expect(restored).toEqual(original);
    });

    it('should ignore invalid rules and retain original text for them', () => {
        const original = [
            '||valid.com^',
            'invalid rule syntax',
            '||another.com^',
        ].join('\n');
        const list = new ConvertedFilterList(original);

        const restored = list.getOriginalContent();
        expect(restored).toEqual(original);
    });

    it('should handle CRLF line endings correctly', () => {
        const original = [
            '||example.com^\r\n',
            '||example.org^',
        ].join('');
        const list = new ConvertedFilterList(original);

        expect(list.getOriginalContent()).toEqual(original);
    });

    it('should not return original rule if the line index is not a line start', () => {
        const original = [
            '||example.com^\n',
            '||example.org^\n',
            '##+js(bar)',
        ].join('');
        const list = new ConvertedFilterList(original);

        expect(list.getOriginalRuleText(0)).toBe('||example.com^');
        expect(list.getOriginalRuleText(
            list.getContent().indexOf("#%#//scriptlet('ubo-bar')"),
        )).toBe('##+js(bar)');
    });

    it('should not return original rule if the line index is not a line start', () => {
        const original = '##+js(bar)';
        const list = new ConvertedFilterList(original);

        expect(list.getOriginalRuleText(0)).toEqual('##+js(bar)'); // not line start, fallback
    });

    it('should return null for out-of-bound index', () => {
        const original = '||example.com^';
        const list = new ConvertedFilterList(original);

        expect(list.getOriginalRuleText(-1)).toBeNull();
        expect(list.getOriginalRuleText(100)).toBeNull();
    });
});
