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

    it('treats a pattern with an escaped closing slash as a basic pattern', () => {
        // The `match-case` flag disables the shortcut branch, so this test
        // checks the compiled regexp for the escaped basic pattern.
        const pattern = new Pattern('/example\\/', true);

        expect(pattern.matchPattern(
            new Request('https://example.org/example\\/', null, RequestType.Document),
            false,
        )).toBeTruthy();

        expect(pattern.matchPattern(
            new Request('https://example.org', null, RequestType.Document),
            false,
        )).toBeFalsy();
    });

    it('keeps an escaped backslash before the closing slash as a regexp', () => {
        // The `match-case` flag disables the shortcut branch, so this test
        // checks the compiled regexp with the delimiters stripped.
        const pattern = new Pattern(String.raw`/a\\/`, true);

        expect(pattern.matchPattern(
            new Request(String.raw`https://example.org/a\/`, null, RequestType.Document),
            false,
        )).toBeTruthy();

        expect(pattern.matchPattern(
            new Request('https://example.org/b', null, RequestType.Document),
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
});
