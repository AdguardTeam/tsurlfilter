/* eslint-disable max-len */
import { describe, expect, it } from 'vitest';

import { UrlTransformModifier } from '../../src/modifiers/url-transform-modifier';

describe('UrlTransformModifier', () => {
    describe('constructor and getValue', () => {
        it('stores the option text', () => {
            const modifier = new UrlTransformModifier('/\\/old\\//\\/new\\//');
            expect(modifier.getValue()).toBe('/\\/old\\//\\/new\\//');
        });

        it('returns empty string for empty value', () => {
            const modifier = new UrlTransformModifier('');
            expect(modifier.getValue()).toBe('');
        });
    });

    describe('getApplyFunc', () => {
        it('returns identity function for empty value', () => {
            const modifier = new UrlTransformModifier('');
            const apply = modifier.getApplyFunc();
            expect(apply('anything')).toBe('anything');
        });

        it('applies regex substitution', () => {
            const modifier = new UrlTransformModifier('/old/new/');
            const apply = modifier.getApplyFunc();
            expect(apply('/old/page')).toBe('/new/page');
        });

        it('adds global flag automatically', () => {
            const modifier = new UrlTransformModifier('/x/y/');
            const apply = modifier.getApplyFunc();
            expect(apply('xaxbx')).toBe('yayby');
        });

        it('respects case-insensitive flag', () => {
            const modifier = new UrlTransformModifier('/OLD/new/i');
            const apply = modifier.getApplyFunc();
            expect(apply('/old/page')).toBe('/new/page');
        });

        it('unescapes dollar sign in replacement', () => {
            const modifier = new UrlTransformModifier('/(a)(b)/\\$1\\$2/');
            const apply = modifier.getApplyFunc();
            expect(apply('ab')).toBe('ab');
        });
    });

    describe('applyToUrl - basic path rewrite', () => {
        it('rewrites URL path', () => {
            const modifier = new UrlTransformModifier('/\\/old\\//\\/new\\//');
            expect(modifier.applyToUrl('https://example.org/old/page')).toBe('https://example.org/new/page');
        });

        it('supports ^ and \\$ anchors (start/end of string)', () => {
            // Rule from testcases: ||httpbin.agrd.dev^$urltransform=/^\/status\/500\$/\/status\/200/
            // The \$ in the filter text is an escaped $ (modifier separator in AdGuard syntax)
            // and should act as the end-of-string anchor in the regex.
            const modifier = new UrlTransformModifier('/^\\/status\\/500\\$/\\/status\\/200/');
            expect(modifier.applyToUrl('https://httpbin.agrd.dev/status/500'))
                .toBe('https://httpbin.agrd.dev/status/200');
        });

        it('does not rewrite when \\$ anchor prevents partial match', () => {
            // With $ anchor, /status/500 must be at the end — /status/500/extra should NOT match
            const modifier = new UrlTransformModifier('/^\\/status\\/500\\$/\\/status\\/200/');
            expect(modifier.applyToUrl('https://httpbin.agrd.dev/status/500/extra'))
                .toBe('https://httpbin.agrd.dev/status/500/extra');
        });

        it('returns original URL when regex does not match', () => {
            const modifier = new UrlTransformModifier('/\\/old\\//\\/new\\//');
            expect(modifier.applyToUrl('https://example.org/other/page')).toBe('https://example.org/other/page');
        });

        it('returns original URL for empty modifier value', () => {
            const modifier = new UrlTransformModifier('');
            expect(modifier.applyToUrl('https://example.org/page')).toBe('https://example.org/page');
        });
    });

    describe('applyToUrl - query string transformation', () => {
        it('strips a query parameter', () => {
            const modifier = new UrlTransformModifier('/\\?tracking=[^&]*//');
            expect(modifier.applyToUrl('https://example.org/page?tracking=abc123'))
                .toBe('https://example.org/page');
        });

        it('strips utm parameter from middle of query', () => {
            const modifier = new UrlTransformModifier('/&utm_source=[^&]*//');
            expect(modifier.applyToUrl('https://example.org/page?bar=1&utm_source=foo'))
                .toBe('https://example.org/page?bar=1');
        });
    });

    describe('applyToUrl - origin preservation', () => {
        it('rejects transforms that would inject a different host via path', () => {
            const modifier = new UrlTransformModifier('/\\/\\//@evil.org/');
            expect(modifier.applyToUrl('https://example.org/')).toBe('https://example.org/');
        });

        it('does not change origin when regex only matches path content', () => {
            const modifier = new UrlTransformModifier('/example/evil/');
            expect(modifier.applyToUrl('https://example.org/path')).toBe('https://example.org/path');
        });

        it('rejects when reconstructed URL has different origin', () => {
            const modifier = new UrlTransformModifier('/^\\//@evil.org\\//');
            const result = modifier.applyToUrl('https://example.org/');
            expect(result).toBe('https://example.org/');
        });

        it('rejects origin change in path-only mode', () => {
            const modifier = new UrlTransformModifier('/example/evil/');
            expect(modifier.isFullUrlMode()).toBe(false);
            expect(modifier.applyToUrl('https://example.org/path')).toBe('https://example.org/path');
        });

        it('rejects credential injection', () => {
            const modifier = new UrlTransformModifier('/\\/\\//@evil.org/');
            expect(modifier.isFullUrlMode()).toBe(false);
            expect(modifier.applyToUrl('https://example.org/')).toBe('https://example.org/');
        });
    });

    describe('applyToUrl - fragment handling', () => {
        it('transforms hash fragment', () => {
            const modifier = new UrlTransformModifier('/#old/#new/');
            expect(modifier.applyToUrl('https://example.org/page#old'))
                .toBe('https://example.org/page#new');
        });
    });

    describe('applyToUrl - capture groups', () => {
        it('uses capture group references in replacement', () => {
            const modifier = new UrlTransformModifier('/(pref\\/).*\\/(suf)/\\$1\\$2/i');
            expect(modifier.applyToUrl('https://example.org/pref/middle/suf'))
                .toBe('https://example.org/pref/suf');
        });
    });

    describe('applyToUrl - invalid URL', () => {
        it('returns original string for unparseable URL', () => {
            const modifier = new UrlTransformModifier('/x/y/');
            expect(modifier.applyToUrl('not-a-url')).toBe('not-a-url');
        });
    });

    describe('isFullUrl - full-URL mode detection', () => {
        it('returns true for pattern starting with ^http://', () => {
            const modifier = new UrlTransformModifier('^http:\\/\\/old\\.com(.*)/http:\\/\\/new.com$1/');
            expect(modifier.isFullUrlMode()).toBe(true);
        });

        it('returns true for pattern starting with ^https://', () => {
            const modifier = new UrlTransformModifier('^https:\\/\\/old\\.com(.*)/https:\\/\\/new.com$1/');
            expect(modifier.isFullUrlMode()).toBe(true);
        });

        it('returns true for pattern starting with ^https?://', () => {
            const modifier = new UrlTransformModifier('^https?:\\/\\/old\\.com(.*)/https:\\/\\/new.com$1/');
            expect(modifier.isFullUrlMode()).toBe(true);
        });

        it('returns false for path-only pattern', () => {
            const modifier = new UrlTransformModifier('/\\/old\\//\\/new\\//');
            expect(modifier.isFullUrlMode()).toBe(false);
        });

        it('returns false for pattern containing http but not starting with ^http', () => {
            const modifier = new UrlTransformModifier('/http/https/');
            expect(modifier.isFullUrlMode()).toBe(false);
        });

        it('returns false for empty value', () => {
            const modifier = new UrlTransformModifier('');
            expect(modifier.isFullUrlMode()).toBe(false);
        });
    });

    describe('applyToUrl - full-URL mode (origin-changing redirects)', () => {
        it('redirects to a different domain', () => {
            const modifier = new UrlTransformModifier('^https:\\/\\/old\\.example\\.com(.*)/https:\\/\\/new.example.net$1/');
            expect(modifier.applyToUrl('https://old.example.com/path?q=1'))
                .toBe('https://new.example.net/path?q=1');
        });

        it('returns original URL when regex does not match', () => {
            const modifier = new UrlTransformModifier('^https:\\/\\/old\\.example\\.com(.*)/https:\\/\\/new.example.net$1/');
            expect(modifier.applyToUrl('https://other.example.com/path'))
                .toBe('https://other.example.com/path');
        });

        it('allows scheme change from http to https', () => {
            const modifier = new UrlTransformModifier('^http:\\/\\/insecure\\.example\\.com(.*)/https:\\/\\/secure.example.com$1/');
            expect(modifier.applyToUrl('http://insecure.example.com/page'))
                .toBe('https://secure.example.com/page');
        });

        it('supports capture groups across origin change', () => {
            const modifier = new UrlTransformModifier('^https:\\/\\/cdn(\\d+)\\.old\\.com(\\/.*)/https:\\/\\/cdn$1.new.com$2/');
            expect(modifier.applyToUrl('https://cdn3.old.com/assets/image.png'))
                .toBe('https://cdn3.new.com/assets/image.png');
        });

        it('supports case-insensitive flag', () => {
            const modifier = new UrlTransformModifier('^https:\\/\\/OLD\\.example\\.com(.*)/https:\\/\\/new.example.com$1/i');
            expect(modifier.applyToUrl('https://old.example.com/page'))
                .toBe('https://new.example.com/page');
        });
    });

    describe('applyToUrl - full-URL mode security (scheme validation)', () => {
        it('rejects javascript: scheme result', () => {
            const modifier = new UrlTransformModifier('^https:\\/\\//javascript:\\/\\//');
            expect(modifier.applyToUrl('https://example.com/page'))
                .toBe('https://example.com/page');
        });

        it('rejects data: scheme result', () => {
            const modifier = new UrlTransformModifier('^https:\\/\\/example\\.com/data:text\\/html,<h1>Hi<\\/h1>/');
            expect(modifier.applyToUrl('https://example.com'))
                .toBe('https://example.com');
        });

        it('rejects file: scheme result', () => {
            const modifier = new UrlTransformModifier('^https:\\/\\/example\\.com(.*)/file:\\/\\/\\/etc\\/passwd/');
            expect(modifier.applyToUrl('https://example.com/page'))
                .toBe('https://example.com/page');
        });

        it('allows http: result', () => {
            const modifier = new UrlTransformModifier('^https:\\/\\/example\\.com(.*)/http:\\/\\/example.com$1/');
            expect(modifier.applyToUrl('https://example.com/page'))
                .toBe('http://example.com/page');
        });

        it('allows ws: result', () => {
            const modifier = new UrlTransformModifier('^https:\\/\\/example\\.com(.*)/ws:\\/\\/example.com$1/');
            expect(modifier.applyToUrl('https://example.com/page'))
                .toBe('ws://example.com/page');
        });

        it('allows wss: result', () => {
            const modifier = new UrlTransformModifier('^https:\\/\\/example\\.com(.*)/wss:\\/\\/example.com$1/');
            expect(modifier.applyToUrl('https://example.com/page'))
                .toBe('wss://example.com/page');
        });

        it('returns original for invalid URL result', () => {
            const modifier = new UrlTransformModifier('^https:\\/\\/example\\.com/not-a-url/');
            expect(modifier.applyToUrl('https://example.com'))
                .toBe('https://example.com');
        });

        it('returns original for empty result', () => {
            const modifier = new UrlTransformModifier('^https:\\/\\/example\\.com.*//');
            expect(modifier.applyToUrl('https://example.com/page'))
                .toBe('https://example.com/page');
        });
    });

    describe('pipeline - pct (percent-decode)', () => {
        it('decodes percent-encoded path', () => {
            const modifier = new UrlTransformModifier('pct');
            expect(modifier.applyToUrl('https://example.com/page%20name'))
                .toBe('https://example.com/page name');
        });

        it('returns original URL on invalid percent sequence', () => {
            const modifier = new UrlTransformModifier('pct');
            expect(modifier.applyToUrl('https://example.com/path%GG'))
                .toBe('https://example.com/path%GG');
        });
    });

    describe('pipeline - b64 (Base64 decode)', () => {
        it('decodes Base64 via getApplyFunc', () => {
            // "hello" → base64 "aGVsbG8="
            const modifier = new UrlTransformModifier('b64');
            expect(modifier.getApplyFunc()('aGVsbG8=')).toBe('hello');
        });

        it('decodes URL-safe Base64 (- and _ instead of + and /)', () => {
            // "i??>" → standard base64 "aT8/Pg==" → url-safe "aT8_Pg"
            const modifier = new UrlTransformModifier('b64');
            expect(modifier.getApplyFunc()('aT8_Pg')).toBe('i??>');
        });

        it('decodes Base64 without padding', () => {
            // "https://example.com" → "aHR0cHM6Ly9leGFtcGxlLmNvbQ" (no ==)
            const modifier = new UrlTransformModifier('b64');
            expect(modifier.getApplyFunc()('aHR0cHM6Ly9leGFtcGxlLmNvbQ')).toBe('https://example.com');
        });

        it('returns input unchanged for invalid Base64', () => {
            const modifier = new UrlTransformModifier('b64');
            expect(modifier.getApplyFunc()('not!valid!base64!')).toBe('not!valid!base64!');
        });
    });

    describe('pipeline - chained transforms', () => {
        it('applies substitute then pct', () => {
            // Extract url= param value with leading /, then percent-decode
            const modifier = new UrlTransformModifier('/.*url=([^&]*).*/\\/\\$1/|pct');
            expect(modifier.applyToUrl('https://tracker.example.com/visit?url=https%3A%2F%2Fshop.com%2F&ref=123'))
                .toBe('https://tracker.example.com/https://shop.com/');
        });

        it('applies pct then b64 via getApplyFunc', () => {
            // "hello" → base64 "aGVsbG8=" → percent-encoded "aGVsbG8%3D"
            const modifier = new UrlTransformModifier('pct|b64');
            expect(modifier.getApplyFunc()('aGVsbG8%3D')).toBe('hello');
        });

        it('applies multiple substitutes in sequence', () => {
            const modifier = new UrlTransformModifier('/X/Y/|/A/B/');
            expect(modifier.applyToUrl('https://example.com/XApath'))
                .toBe('https://example.com/YBpath');
        });

        it('failed substitute passes through to next transform', () => {
            const modifier = new UrlTransformModifier('/nomatch/Y/|pct');
            expect(modifier.applyToUrl('https://example.com/hello%20world'))
                .toBe('https://example.com/hello world');
        });

        it('handles regex with | alternation inside substitute', () => {
            const modifier = new UrlTransformModifier('/a|b/c/');
            expect(modifier.applyToUrl('https://example.com/a'))
                .toBe('https://example.com/c');
            expect(modifier.applyToUrl('https://example.com/b'))
                .toBe('https://example.com/c');
        });
    });

    describe('pipeline - full-URL mode', () => {
        it('detects full-URL mode from first substitute in pipeline', () => {
            const modifier = new UrlTransformModifier('^https?:\\/\\/tracker\\.example\\.com\\/.*url=([^&]*).*/\\$1/|pct');
            expect(modifier.isFullUrlMode()).toBe(true);
        });

        it('applies full-URL pipeline with pct decode', () => {
            const modifier = new UrlTransformModifier('^https?:\\/\\/tracker\\.example\\.com\\/.*url=([^&]*).*/\\$1/|pct');
            expect(modifier.applyToUrl('https://tracker.example.com/visit?url=https%3A%2F%2Fshop.com%2F'))
                .toBe('https://shop.com/');
        });

        it('decode-only pipeline uses path-only mode', () => {
            const modifier = new UrlTransformModifier('pct');
            expect(modifier.isFullUrlMode()).toBe(false);
        });
    });

    describe('pipeline - backward compatibility', () => {
        it('single substitute works identically to before', () => {
            const modifier = new UrlTransformModifier('/\\/old\\//\\/new\\//');
            expect(modifier.applyToUrl('https://example.org/old/page'))
                .toBe('https://example.org/new/page');
        });

        it('getValue returns full pipeline text', () => {
            const modifier = new UrlTransformModifier('/X/Y/|pct');
            expect(modifier.getValue()).toBe('/X/Y/|pct');
        });

        it('empty value still produces identity transform', () => {
            const modifier = new UrlTransformModifier('');
            expect(modifier.applyToUrl('https://example.com/page'))
                .toBe('https://example.com/page');
        });
    });

    describe('pipeline - edge cases', () => {
        it('empty segment treated as no-op', () => {
            const modifier = new UrlTransformModifier('|pct');
            expect(modifier.applyToUrl('https://example.com/hello%20world'))
                .toBe('https://example.com/hello world');
        });

        it('double pct decode', () => {
            const modifier = new UrlTransformModifier('pct|pct');
            expect(modifier.applyToUrl('https://example.com/hello%2520world'))
                .toBe('https://example.com/hello world');
        });
    });
});
