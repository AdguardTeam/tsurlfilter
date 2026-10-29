import { describe, expect, test } from 'vitest';

import { collectRegexValueRegions } from '../../src/utils/regex-value-regions';

describe('collectRegexValueRegions', () => {
    test('covers the pattern and the replacement part', () => {
        const rule = '||example.org^$replace=/(a)/$1/';

        expect(collectRegexValueRegions(rule)).toEqual([
            [rule.indexOf('/'), rule.lastIndexOf('/') + 1],
        ]);
    });

    test('stops the replacement scan at a comma', () => {
        const rule = '||example.org^$replace=/a/g,domain=example.com';

        // The `g` after the closing slash is not a replacement part, because
        // the next character is a comma, not a closing slash.
        expect(collectRegexValueRegions(rule)).toEqual([
            [rule.indexOf('/'), rule.indexOf('/g') + 1],
        ]);
    });

    test('ignores escaped slashes', () => {
        const rule = '||example.org^$replace=/a\\/b$c/';

        expect(collectRegexValueRegions(rule)).toHaveLength(1);
    });

    test('scans only the given range', () => {
        const first = '||a.com^$replace=/x$y/';
        const second = '||b.com^$replace=/z$w/';
        const source = `${first}\n${second}`;
        const start = first.length + 1;

        const regions = collectRegexValueRegions(source, start, source.length);

        expect(regions).toHaveLength(1);
        expect(regions[0][0]).toBe(source.indexOf('/z'));
        expect(regions[0][1]).toBe(source.lastIndexOf('/') + 1);
    });

    test('returns no regions when the value has no closing slash', () => {
        expect(collectRegexValueRegions('||a.com^$replace=/abc')).toEqual([]);
    });

    test('ignores a =/ sequence in the pattern', () => {
        const rule = '||example.com/?u=/x$script,removeparam=/y/';

        expect(collectRegexValueRegions(rule)).toEqual([
            [rule.indexOf('/y'), rule.length],
        ]);
    });

    test('ignores a =/ sequence that does not follow a modifier name', () => {
        const rule = '||x-trojmiasto.pl/combo/f=/_style/$replace=/(.\\$)/\\$1.banner-maxia/,stylesheet';

        const regions = collectRegexValueRegions(rule);

        expect(regions).toHaveLength(1);
        expect(regions[0][0]).toBe(rule.indexOf('/(.'));
        expect(regions[0][1]).toBe(rule.lastIndexOf('/') + 1);
    });

    test('opens a region after a comma-separated modifier name', () => {
        const rule = '||example.com^$script,removeparam=/x$y/';

        expect(collectRegexValueRegions(rule)).toEqual([
            [rule.indexOf('/x'), rule.lastIndexOf('/') + 1],
        ]);
    });

    test('opens a region after a negated modifier name', () => {
        const rule = '||example.com^$~removeparam=/x$y/';

        expect(collectRegexValueRegions(rule)).toEqual([
            [rule.indexOf('/x'), rule.lastIndexOf('/') + 1],
        ]);
    });
});
