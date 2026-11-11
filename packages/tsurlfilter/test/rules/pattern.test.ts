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

    it('matches the regex against the whole URL', () => {
        const pattern = new Pattern('/tech.*top');
        const tail = 'a'.repeat(Request.MAX_URL_MATCH_LENGTH + 500);

        // The regex sees the whole URL: a cut at a fixed length would both
        // hide a match that lives past it and let an end-anchored pattern
        // match at the cut.
        expect(pattern.matchPattern(
            new Request(`https://example.org/tech.${tail}top`, null, RequestType.Document),
            false,
        )).toBeTruthy();

        expect(pattern.matchPattern(
            new Request('https://example.org/tech.xatop', null, RequestType.Document),
            false,
        )).toBeTruthy();
    });

    it('does not treat the cut of a long URL as its end', () => {
        const pattern = new Pattern('||example.org^*.js|');
        const tail = 'a'.repeat(Request.MAX_URL_MATCH_LENGTH - 'https://example.org/.js'.length);

        // `.js` ends exactly at the cut, but the URL continues: an end anchor
        // must not match there.
        expect(pattern.matchPattern(
            new Request(`https://example.org/${tail}.js&more=1`, null, RequestType.Document),
            false,
        )).toBeFalsy();
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

    it('does not shortcut the `pattern*` shape with $match-case', () => {
        const pattern = new Pattern('/example/*', true);
        const request = new Request('https://example.org/EXAMPLE/x', null, RequestType.Document);

        // A substring search is case-insensitive: `$match-case` must keep the
        // regex, otherwise the rule matches a page it does not match in the
        // engine.
        expect(pattern.matchPattern(request, false)).toBeFalsy();
    });
});
