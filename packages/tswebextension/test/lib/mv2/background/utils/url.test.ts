import { getHost, isThirdPartyRequest } from '../../../../../src/lib/common/utils/url';

describe('Url utils', () => {
    it('parses url host', () => {
        expect(getHost('https://example.org')).toBe('example.org');
        expect(getHost('https://www.example.org')).toBe('www.example.org');
        expect(getHost('https://www.example.org/path')).toBe('www.example.org');
        expect(getHost('https://www.example.org/path?query')).toBe('www.example.org');
        expect(getHost('stun:example.org')).toBe('example.org');
    });

    it('checks third party requests detect', () => {
        expect(isThirdPartyRequest('http://example.org', 'http://example.org')).toBeFalsy();
        expect(isThirdPartyRequest('http://example.org/path', 'http://example.org')).toBeFalsy();
        expect(isThirdPartyRequest('http://example.org', 'http://example.com')).toBeTruthy();
        expect(isThirdPartyRequest('http://example.org/path', 'http://example.com')).toBeTruthy();
    });
});
