/* eslint-disable max-len */
import { getHost } from '@lib/common/utils';
import { isThirdPartyRequest } from '@lib/mv2/background/utils/url';

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
