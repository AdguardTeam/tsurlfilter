/* eslint-disable max-len */
import * as utils from '../../src/utils/url';

describe('Url utils', () => {
    it('checks third party requests detect', () => {
        expect(utils.isThirdPartyRequest('http://example.org', 'http://example.org')).toBeFalsy();
        expect(utils.isThirdPartyRequest('http://example.org/path', 'http://example.org')).toBeFalsy();
        expect(utils.isThirdPartyRequest('http://example.org', 'http://example.com')).toBeTruthy();
        expect(utils.isThirdPartyRequest('http://example.org/path', 'http://example.com')).toBeTruthy();
    });

    it('parses url host', () => {
        expect(utils.getHost('https://example.org')).toBe('example.org');
        expect(utils.getHost('https://www.example.org')).toBe('www.example.org');
        expect(utils.getHost('https://www.example.org/path')).toBe('www.example.org');
        expect(utils.getHost('https://www.example.org/path?query')).toBe('www.example.org');
        expect(utils.getHost('stun:example.org')).toBe('example.org');
    });
});

describe('Query parameters', () => {
    it('checks regexp cleaning', () => {
        expect(utils.cleanUrlParamByRegExp('http://example.com', /.*/)).toEqual('http://example.com');
        expect(utils.cleanUrlParamByRegExp('http://example.com?test', /test.*/)).toEqual('http://example.com');
        expect(utils.cleanUrlParamByRegExp('http://example.com?test', /test=/)).toEqual('http://example.com');
        expect(utils.cleanUrlParamByRegExp('http://example.com?test=1', /test=1/)).toEqual('http://example.com');
        expect(utils.cleanUrlParamByRegExp('http://example.com?test=1', /test.*/)).toEqual('http://example.com');
        expect(utils.cleanUrlParamByRegExp('http://example.com?test=1&stay=2', /test=1/)).toEqual('http://example.com?stay=2');
        expect(utils.cleanUrlParamByRegExp('https://example.com/??.comments.js?v=1619510974', /comments/)).toEqual('https://example.com/');
        expect(utils.cleanUrlParamByRegExp('http://example.com?stay=&stay2=2', /test=1/)).toEqual('http://example.com?stay=&stay2=2');
    });

    it('checks params cleaning', () => {
        expect(utils.cleanUrlParam('http://example.com', [])).toEqual('http://example.com');
        expect(utils.cleanUrlParam('http://example.com?test=1', ['test'])).toEqual('http://example.com');
        expect(utils.cleanUrlParam('http://example.com?test', ['test'])).toEqual('http://example.com');
        expect(utils.cleanUrlParam('http://example.com?test=1', ['not_test'])).toEqual('http://example.com?test=1');
        expect(utils.cleanUrlParam('http://example.com?not_test=1', ['test'])).toEqual('http://example.com?not_test=1');
        expect(utils.cleanUrlParam('http://example.com?test=1&stay=2', ['test'])).toEqual('http://example.com?stay=2');
        expect(utils.cleanUrlParam('http://example.com?test=1&remove=2', ['test', 'remove'])).toEqual('http://example.com');
        expect(utils.cleanUrlParam('https://example.com/??.comments.js?v=1619510974', ['v'])).toEqual('https://example.com/??.comments.js?v=1619510974');
    });

    it('checks inverted regexp cleaning', () => {
        expect(utils.cleanUrlParamByRegExp('http://example.com', /.*/, true)).toEqual('http://example.com');
        expect(utils.cleanUrlParamByRegExp('http://example.com?test', /test.*/, true)).toEqual('http://example.com?test');
        expect(utils.cleanUrlParamByRegExp('http://example.com?test=1', /test=1/, true)).toEqual('http://example.com?test=1');
        expect(utils.cleanUrlParamByRegExp('http://example.com?test=1', /test.*/, true)).toEqual('http://example.com?test=1');
        expect(utils.cleanUrlParamByRegExp('http://example.com?test=1&test=2', /test.*/, true)).toEqual('http://example.com?test=1&test=2');
        expect(utils.cleanUrlParamByRegExp('http://example.com?test=1&test=2', /test=1/, true)).toEqual('http://example.com?test=1');
    });

    it('checks inverted params cleaning', () => {
        expect(utils.cleanUrlParam('http://example.com', [], true)).toEqual('http://example.com');
        expect(utils.cleanUrlParam('http://example.com?test=1', ['test'], true)).toEqual('http://example.com?test=1');
        expect(utils.cleanUrlParam('http://example.com?test=1', ['not_test'], true)).toEqual('http://example.com');
        expect(utils.cleanUrlParam('http://example.com?test=1&remove=2', ['test'], true)).toEqual('http://example.com?test=1');
    });
});
