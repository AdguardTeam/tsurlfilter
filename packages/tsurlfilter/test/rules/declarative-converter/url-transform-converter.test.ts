import { describe, expect, it } from 'vitest';

import {
    convertFullUrlTransform,
    convertPathOnlyTransform,
    convertReplacementToDnr,
    convertUrlTransformToDnr,
    countCaptureGroups,
    parseUrlTransformParts,
} from '../../../src/rules/declarative-converter/url-transform-converter';

describe('parseUrlTransformParts', () => {
    it('parses full-URL pattern with single capture group', () => {
        const result = parseUrlTransformParts(
            '/^https:\\/\\/old\\.example\\.com(.*)/https:\\/\\/new.example.net$1/',
        );
        expect(result).toEqual({
            pattern: '^https:\\/\\/old\\.example\\.com(.*)',
            replacement: 'https:\\/\\/new.example.net$1',
            flags: '',
        });
    });

    it('parses pattern with /i flag', () => {
        const result = parseUrlTransformParts(
            '/^https:\\/\\/TRACKER\\.example\\.com(.*)/https:\\/\\/clean.example.com$1/i',
        );
        expect(result).toEqual({
            pattern: '^https:\\/\\/TRACKER\\.example\\.com(.*)',
            replacement: 'https:\\/\\/clean.example.com$1',
            flags: 'i',
        });
    });

    it('parses path-only pattern', () => {
        const result = parseUrlTransformParts('/\\/old\\//\\/new\\//');
        expect(result).toEqual({
            pattern: '\\/old\\/',
            replacement: '\\/new\\/',
            flags: '',
        });
    });

    it('handles escaped slashes in pattern and replacement', () => {
        const result = parseUrlTransformParts('/\\/(old)(\\d+)\\//\\/new-$1-$2\\//');
        expect(result).toEqual({
            pattern: '\\/(old)(\\d+)\\/',
            replacement: '\\/new-$1-$2\\/',
            flags: '',
        });
    });
});

describe('convertReplacementToDnr', () => {
    it('converts $1, $2, $3 to \\1, \\2, \\3', () => {
        expect(convertReplacementToDnr('https://new.example.net$1', 0)).toBe('https://new.example.net\\1');
    });

    it('converts $0 to \\0', () => {
        expect(convertReplacementToDnr('$0-suffix', 0)).toBe('\\0-suffix');
    });

    it('converts escaped \\$N as backreference (filter syntax escaping)', () => {
        expect(convertReplacementToDnr('https://new.example.net\\$1', 0)).toBe('https://new.example.net\\1');
    });

    it('converts escaped \\$ (not followed by digit) to literal $', () => {
        expect(convertReplacementToDnr('price is \\$', 0)).toBe('price is $');
    });

    it('shifts group refs by offset', () => {
        expect(convertReplacementToDnr('/new-$1-$2/', 1)).toBe('/new-\\2-\\3/');
    });

    it('shifts escaped group refs by offset', () => {
        expect(convertReplacementToDnr('/new-\\$1-\\$2/', 1)).toBe('/new-\\2-\\3/');
    });

    it('handles mixed refs and escaped dollars', () => {
        expect(convertReplacementToDnr('$1\\$2$3', 0)).toBe('\\1\\2\\3');
    });
});

describe('convertFullUrlTransform', () => {
    it('converts full-URL transform to DNR regex+substitution', () => {
        const result = convertFullUrlTransform(
            '^https://old\\.example\\.com(.*)',
            'https://new.example.net$1',
            '',
        );
        expect(result).toEqual({
            regexFilter: '^https://old\\.example\\.com(.*)',
            regexSubstitution: 'https://new.example.net\\1',
            isUrlFilterCaseSensitive: undefined,
        });
    });

    it('handles /i flag', () => {
        const result = convertFullUrlTransform(
            '^https://TRACKER\\.example\\.com(.*)',
            'https://clean.example.com$1',
            'i',
        );
        expect(result).toEqual({
            regexFilter: '^https://TRACKER\\.example\\.com(.*)',
            regexSubstitution: 'https://clean.example.com\\1',
            isUrlFilterCaseSensitive: false,
        });
    });

    it('converts multiple capture groups', () => {
        const result = convertFullUrlTransform(
            '^https://cdn(\\d+)\\.old\\.com(/.*)',
            'https://cdn$1.new.com$2',
            '',
        );
        expect(result).toEqual({
            regexFilter: '^https://cdn(\\d+)\\.old\\.com(/.*)',
            regexSubstitution: 'https://cdn\\1.new.com\\2',
            isUrlFilterCaseSensitive: undefined,
        });
    });

    it('unescapes \\/ to / in pattern and replacement', () => {
        const result = convertFullUrlTransform(
            '^https:\\/\\/example.org',
            'https:\\/\\/httpbin.agrd.dev',
            '',
        );
        expect(result).toEqual({
            regexFilter: '^https://example.org',
            regexSubstitution: 'https://httpbin.agrd.dev',
            isUrlFilterCaseSensitive: undefined,
        });
    });

    it('unescapes \\$ to $ (end-of-string anchor) in pattern', () => {
        const result = convertFullUrlTransform(
            '^https:\\/\\/httpbin.agrd.dev\\/status\\/500\\$',
            'https:\\/\\/httpbin.agrd.dev\\/status\\/200',
            '',
        );
        expect(result).toEqual({
            regexFilter: '^https://httpbin.agrd.dev/status/500$',
            regexSubstitution: 'https://httpbin.agrd.dev/status/200',
            isUrlFilterCaseSensitive: undefined,
        });
    });
});

describe('countCaptureGroups', () => {
    it('counts simple groups', () => {
        expect(countCaptureGroups('(a)(b)(c)')).toBe(3);
    });

    it('ignores non-capturing groups', () => {
        expect(countCaptureGroups('(?:a)(b)')).toBe(1);
    });

    it('ignores escaped parens', () => {
        expect(countCaptureGroups('\\(a\\)(b)')).toBe(1);
    });

    it('ignores parens inside character classes', () => {
        expect(countCaptureGroups('[(](b)')).toBe(1);
    });

    it('returns 0 for no groups', () => {
        expect(countCaptureGroups('abc')).toBe(0);
    });
});

describe('convertPathOnlyTransform', () => {
    it('wraps path-only pattern with origin capture', () => {
        const result = convertPathOnlyTransform(
            '\\/old\\/',
            '\\/new\\/',
            '',
        );
        expect(result).toEqual({
            regexFilter: '^(https?://[^/]+)/old/(.*)',
            regexSubstitution: '\\1/new/\\2',
            isUrlFilterCaseSensitive: undefined,
        });
    });

    it('shifts user capture groups by 1', () => {
        const result = convertPathOnlyTransform(
            '\\/(old)(\\d+)\\/',
            '\\/new-$1-$2\\/',
            '',
        );
        expect(result).toEqual({
            regexFilter: '^(https?://[^/]+)/(old)(\\d+)/(.*)',
            regexSubstitution: '\\1/new-\\2-\\3/\\4',
            isUrlFilterCaseSensitive: undefined,
        });
    });

    it('handles query parameter removal', () => {
        const result = convertPathOnlyTransform(
            '\\?utm_source=[^&]*&?',
            '',
            '',
        );
        expect(result).toEqual({
            regexFilter: '^(https?://[^?]+)\\?utm_source=[^&]*&?(.*)',
            regexSubstitution: '\\1\\2',
            isUrlFilterCaseSensitive: undefined,
        });
    });

    it('unescapes \\$ to $ (end-of-string anchor) in pattern', () => {
        // Rule: ||httpbin.agrd.dev^$urltransform=/^\/status\/500\$/\/status\/200/
        const result = convertPathOnlyTransform(
            '^\\/status\\/500\\$',
            '\\/status\\/200',
            '',
        );
        // ^ is stripped (prefix anchors start), \$ becomes $ end anchor,
        // no remainder group is appended because of the end anchor
        expect(result).toEqual({
            regexFilter: '^(https?://[^/]+)/status/500$',
            regexSubstitution: '\\1/status/200',
            isUrlFilterCaseSensitive: undefined,
        });
    });
});

describe('convertUrlTransformToDnr', () => {
    it('converts single-stage full-URL transform', () => {
        const results = convertUrlTransformToDnr(
            '/^https:\\/\\/old\\.example\\.com(.*)/https:\\/\\/new.example.net$1/',
        );
        expect(results).toHaveLength(1);
        expect(results[0].regexFilter).toBe('^https://old\\.example\\.com(.*)');
        expect(results[0].regexSubstitution).toBe('https://new.example.net\\1');
    });

    it('converts full-URL transform without capture groups (no crash)', () => {
        // Rule: ||example.org^$urltransform=/^https:\/\/example.org/https:\/\/httpbin.agrd.dev/
        // This rule previously caused a crash because \/ was left in regexSubstitution,
        // and Chrome DNR interprets \ as a backreference prefix.
        const results = convertUrlTransformToDnr(
            '/^https:\\/\\/example.org/https:\\/\\/httpbin.agrd.dev/',
        );
        expect(results).toHaveLength(1);
        expect(results[0].regexFilter).toBe('^https://example.org');
        expect(results[0].regexSubstitution).toBe('https://httpbin.agrd.dev');
    });

    it('throws for pipeline with b64 decode stage', () => {
        expect(() => convertUrlTransformToDnr(
            '/\\/old\\//\\/new\\//|b64',
        )).toThrow(/decode stages.*not supported/i);
    });

    it('throws for pipeline with pct decode stage', () => {
        expect(() => convertUrlTransformToDnr(
            '/\\/old\\//\\/new\\//|pct',
        )).toThrow(/decode stages.*not supported/i);
    });

    // Example: ||example.org^$urltransform=/\/old\//\/new\//|/tracking-/clean-/
    // Given URL: https://example.org/old/tracking-page
    // Stage 1: /old/ → /new/  => https://example.org/new/tracking-page
    // Stage 2: tracking- → clean- => https://example.org/new/clean-page
    it('converts 2-stage pipeline into 2 results', () => {
        const results = convertUrlTransformToDnr(
            '/\\/old\\//\\/new\\//|/tracking-/clean-/',
        );
        expect(results).toHaveLength(2);
        // First stage: pattern starts with \/, so it's path-anchored
        expect(results[0].regexFilter).toBe('^(https?://[^/]+)/old/(.*)');
        expect(results[0].regexSubstitution).toBe('\\1/new/\\2');
        // Second stage: pattern doesn't start with \/, so it floats (matches anywhere in path)
        expect(results[1].regexFilter).toBe('^(https?://[^?#]*?)tracking-(.*)');
        expect(results[1].regexSubstitution).toBe('\\1clean-\\2');
    });

    // Testcase rules from rules_2.md
    it('converts Case 1: path-only with ^ and \\$ anchors', () => {
        // ||httpbin.agrd.dev^$urltransform=/^\/status\/500\$/\/status\/200/
        const results = convertUrlTransformToDnr(
            '/^\\/status\\/500\\$/\\/status\\/200/',
        );
        expect(results).toHaveLength(1);
        expect(results[0].regexFilter).toBe('^(https?://[^/]+)/status/500$');
        expect(results[0].regexSubstitution).toBe('\\1/status/200');
    });

    it('converts Case 2: floating path-only substitution', () => {
        // ||httpbin.agrd.dev^$urltransform=/royalmail/post/
        const results = convertUrlTransformToDnr('/royalmail/post/');
        expect(results).toHaveLength(1);
        expect(results[0].regexFilter).toBe('^(https?://[^?#]*?)royalmail(.*)');
        expect(results[0].regexSubstitution).toBe('\\1post\\2');
    });

    it('converts Case 5: path-only with ^ and \\$ anchors (script)', () => {
        // ||httpbin.agrd.dev^$script,urltransform=/^\/status\/502$/\/status\/200/
        // (same transform as Case 1 but with an explicit $script modifier —
        //  modifier handling is in the converter, but transform itself is the same)
        const results = convertUrlTransformToDnr(
            '/^\\/status\\/502\\$/\\/status\\/200/',
        );
        expect(results).toHaveLength(1);
        expect(results[0].regexFilter).toBe('^(https?://[^/]+)/status/502$');
        expect(results[0].regexSubstitution).toBe('\\1/status/200');
    });
});
