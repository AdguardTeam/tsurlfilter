/* eslint-disable max-len */
import * as utils from '../../src/utils/url';

describe('Url utils', () => {
    it('parses url relative part', () => {
        expect(utils.getRelativeUrl('https://example.org')).toBe(null);
        expect(utils.getRelativeUrl('http://example.org/path/sub')).toBe('/path/sub');
        expect(utils.getRelativeUrl('http://example.org/path?query')).toBe('/path?query');
    });
});

describe('Query parameters', () => {
    it('checks regexp cleaning', () => {
        expect(utils.cleanUrlParamByRegExp('http://example.com', /.*/)).toEqual('http://example.com');
        expect(utils.cleanUrlParamByRegExp('http://example.com?test', /test.*/)).toEqual('http://example.com');
        expect(utils.cleanUrlParamByRegExp('http://example.com?test', /test=/)).toEqual('http://example.com');
        expect(utils.cleanUrlParamByRegExp('http://example.com?test=1', /test=1/)).toEqual('http://example.com');
        expect(utils.cleanUrlParamByRegExp('http://example.com?test=1', /test.*/)).toEqual('http://example.com');
        expect(utils.cleanUrlParamByRegExp('http://example.com?test=1#hash', /test.*/)).toEqual('http://example.com#hash');
        expect(utils.cleanUrlParamByRegExp('http://example.com?test=1&stay=2', /test=1/)).toEqual('http://example.com?stay=2');
        expect(utils.cleanUrlParamByRegExp('https://example.com/??.comments.js?v=1619510974', /comments/)).toEqual('https://example.com/');
        expect(utils.cleanUrlParamByRegExp('http://example.com?stay=&stay2=2', /test=1/)).toEqual('http://example.com?stay=&stay2=2');
        expect(utils.cleanUrlParamByRegExp('http://example.com?stay=&stay2=2#hash', /test=1/)).toEqual('http://example.com?stay=&stay2=2#hash');
    });

    it('checks inverted regexp cleaning', () => {
        expect(utils.cleanUrlParamByRegExp('http://example.com', /.*/, true)).toEqual('http://example.com');
        expect(utils.cleanUrlParamByRegExp('http://example.com?test', /test.*/, true)).toEqual('http://example.com?test');
        expect(utils.cleanUrlParamByRegExp('http://example.com?test=1', /test=1/, true)).toEqual('http://example.com?test=1');
        expect(utils.cleanUrlParamByRegExp('http://example.com?test=1', /test.*/, true)).toEqual('http://example.com?test=1');
        expect(utils.cleanUrlParamByRegExp('http://example.com?test=1&test=2', /test.*/, true)).toEqual('http://example.com?test=1&test=2');
        expect(utils.cleanUrlParamByRegExp('http://example.com?test=1&test=2', /test=1/, true)).toEqual('http://example.com?test=1');
    });
});
