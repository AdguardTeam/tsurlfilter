import { Pattern } from '../../src/rules/pattern';
import { Request } from '../../src/request';
import { RequestType } from '../../src/request-type';

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
