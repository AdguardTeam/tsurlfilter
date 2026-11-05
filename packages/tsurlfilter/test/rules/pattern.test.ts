import { describe, expect, it } from 'vitest';

import { Request } from '../../src/request';
import { RequestType } from '../../src/request-type';
import { Pattern } from '../../src/rules/pattern';

describe('Pattern Tests', () => {
    it('matches shortcut simple cases', () => {
        const pattern = new Pattern('example');

        expect(pattern.matchPattern(
            new Request('https://example.org', null, RequestType.Document),
            false,
        )).toBeTruthy();

        expect(pattern.matchPattern(
            new Request('https://example.org', null, RequestType.Document),
            true,
        )).toBeTruthy();

        expect(pattern.matchPattern(
            new Request('https://test.org', null, RequestType.Document),
            false,
        )).toBeFalsy();

        expect(pattern.matchPattern(
            new Request('https://test.org', null, RequestType.Document),
            true,
        )).toBeTruthy();
    });

    it('matches shortcut wildcard cases', () => {
        const pattern = new Pattern('/example*');

        expect(pattern.matchPattern(
            new Request('https://example.org', null, RequestType.Document),
            false,
        )).toBeTruthy();

        expect(pattern.matchPattern(
            new Request('https://example.org', null, RequestType.Document),
            true,
        )).toBeTruthy();

        expect(pattern.matchPattern(
            new Request('https://test.org', null, RequestType.Document),
            false,
        )).toBeFalsy();

        expect(pattern.matchPattern(
            new Request('https://test.org', null, RequestType.Document),
            true,
        )).toBeTruthy();
    });

    it('matches hostname cases', () => {
        const pattern = new Pattern('||example.org^');

        expect(pattern.matchPattern(
            new Request('https://example.org', null, RequestType.Document),
            false,
        )).toBeTruthy();

        expect(pattern.matchPattern(
            new Request('https://sub.example.org', null, RequestType.Document),
            false,
        )).toBeTruthy();

        expect(pattern.matchPattern(
            new Request('https://test.org', null, RequestType.Document),
            false,
        )).toBeFalsy();
    });

    it('does not match non hostname cases', () => {
        const pattern = new Pattern('||*/te/^');

        expect(pattern.matchPattern(
            new Request('https://test.ru/te/', null, RequestType.Document),
            false,
        )).toBeTruthy();

        expect(pattern.matchPattern(
            new Request('https://test.ru/other/', null, RequestType.Document),
            false,
        )).toBeFalsy();
    });

    it('matches regexp', () => {
        const pattern = new Pattern('/example/');

        expect(pattern.matchPattern(
            new Request('https://example.org', null, RequestType.Document),
            false,
        )).toBeTruthy();

        expect(pattern.matchPattern(
            new Request('https://test.org', null, RequestType.Document),
            false,
        )).toBeFalsy();
    });

    it('detects invalid regexp', () => {
        const pattern = new Pattern('/example\\/');

        expect(pattern.matchPattern(
            new Request('https://example.org', null, RequestType.Document),
            false,
        )).toBeFalsy();
    });

    it('matches the regex against the shortened URL', () => {
        const pattern = new Pattern('/tech.*top');
        const tail = 'a'.repeat(Request.MAX_URL_MATCH_LENGTH + 500);

        // A match living past the cap is invisible to the regex, the same way
        // it is invisible to the shortcut check: the input of a backtracking
        // pattern stays bounded.
        expect(pattern.matchPattern(
            new Request(`https://example.org/tech.${tail}top`, null, RequestType.Document),
            false,
        )).toBeFalsy();

        expect(pattern.matchPattern(
            new Request('https://example.org/tech.xatop', null, RequestType.Document),
            false,
        )).toBeTruthy();
    });

    it('matches hostname with regexp', () => {
        const pattern = new Pattern('/path/');

        const request = new Request('https://example.org/path', null, RequestType.Document);

        request.isHostnameRequest = false;
        expect(pattern.matchPattern(
            request,
            false,
        )).toBeTruthy();

        request.isHostnameRequest = true;
        expect(pattern.matchPattern(
            request,
            false,
        )).toBeFalsy();
    });

    describe('getPatternMatcher', () => {
        it.each([
            ['example', { mode: 'shortcut', shortcut: 'example' }],
            ['/example/*', { mode: 'shortcut', shortcut: '/example/' }],
            ['||example.org^', { mode: 'hostname', hostname: 'example.org' }],
            ['||example.org/path', {
                mode: 'regex',
                source: '^(http|https|ws|wss):\\/\\/([a-z0-9-_.]+\\.)?example\\.org\\/path',
                flags: 'i',
            }],
            ['||^', { mode: 'invalid' }],
            ['/(/', { mode: 'invalid' }],
        ])('describes %s', (patternText, expected) => {
            expect(new Pattern(patternText).getPatternMatcher()).toEqual(expected);
        });

        it('keeps $match-case on the regex path, so the case is respected', () => {
            expect(new Pattern('example', true).getPatternMatcher()).toEqual({
                mode: 'regex',
                source: 'example',
                flags: '',
            });
        });

        it('does not shortcut the `pattern*` shape with $match-case', () => {
            const pattern = new Pattern('/example/*', true);
            const request = new Request('https://example.org/EXAMPLE/x', null, RequestType.Document);

            expect(pattern.getPatternMatcher().mode).toBe('regex');
            expect(pattern.matchPattern(request, false)).toBeFalsy();
        });
    });
});
