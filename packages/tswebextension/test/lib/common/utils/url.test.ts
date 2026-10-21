import { describe, expect, it } from 'vitest';

import { isPlainHostname, normalizeDomain } from '../../../../src/lib/common/utils/url';

describe('normalizeDomain', () => {
    it('lower-cases the domain', () => {
        expect(normalizeDomain('YouTube.com')).toBe('youtube.com');
    });

    it('trims surrounding whitespace', () => {
        expect(normalizeDomain('  youtube.com  ')).toBe('youtube.com');
    });

    it('strips leading and trailing dots', () => {
        expect(normalizeDomain('.youtube.com.')).toBe('youtube.com');
    });

    it('keeps a leading www prefix (apex and www are distinct hosts)', () => {
        expect(normalizeDomain('www.youtube.com')).toBe('www.youtube.com');
    });

    it('combines all normalizations at once', () => {
        expect(normalizeDomain('  .WWW.YouTube.Com. ')).toBe('www.youtube.com');
    });

    it('leaves an already-normalized domain unchanged', () => {
        expect(normalizeDomain('youtube.com')).toBe('youtube.com');
    });

    it('canonicalizes a non-ASCII domain to punycode', () => {
        // A raw IDN key would never match a browser-reported (punycode) hostname.
        expect(normalizeDomain('пример.рф')).toBe('xn--e1afmkfd.xn--p1ai');
    });

    it('canonicalizes a non-ASCII www alias', () => {
        expect(normalizeDomain('WWW.Пример.РФ')).toBe('www.xn--e1afmkfd.xn--p1ai');
    });

    it('leaves an already-punycoded domain unchanged', () => {
        expect(normalizeDomain('xn--e1afmkfd.xn--p1ai')).toBe('xn--e1afmkfd.xn--p1ai');
    });

    it('falls back to best-effort normalization for an unparseable domain', () => {
        expect(normalizeDomain('  not a domain  ')).toBe('not a domain');
    });
});

describe('isPlainHostname', () => {
    it('accepts a multi-label hostname', () => {
        expect(isPlainHostname('www.youtube.com')).toBe(true);
    });

    it('accepts a single-label host', () => {
        expect(isPlainHostname('localhost')).toBe(true);
    });

    it('rejects a wildcard', () => {
        expect(isPlainHostname('*')).toBe(false);
    });

    it('rejects a scheme and a path', () => {
        expect(isPlainHostname('https://youtube.com/watch')).toBe(false);
    });

    it('rejects empty and malformed labels', () => {
        expect(isPlainHostname('')).toBe(false);
        expect(isPlainHostname('youtube..com')).toBe(false);
        expect(isPlainHostname('-youtube.com')).toBe(false);
    });
});
