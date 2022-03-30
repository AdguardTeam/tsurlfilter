/* eslint-disable max-len */
import {
    DEFAULT_CHARSET,
    parseCharsetFromHeader,
    parseCharsetFromHtml,
    parseCharsetFromCss,
    WIN_1251,
} from '../../src/content-filtering/charsets';

describe('Content filtering - charsets', () => {
    it('checks parsing charset from header', () => {
        expect(parseCharsetFromHeader('text/html; charset=utf-8')).toBe(DEFAULT_CHARSET);
        expect(parseCharsetFromHeader('text/html; charset=windows-1251')).toBe(WIN_1251);
        expect(parseCharsetFromHeader('text/html; charset="windows-1251"')).toBe(WIN_1251);
        expect(parseCharsetFromHeader('')).toBeNull();
        expect(parseCharsetFromHeader('smth else')).toBeNull();
    });

    /**
     * <meta charset="utf-8" />
     * <meta charset=utf-8 />
     * <meta charset=utf-8>
     * <meta http-equiv="Content-type" content="text/html; charset=utf-8" />
     * <meta content="text/html; charset=utf-8" http-equiv="Content-type" />
     */
    it('checks parsing charset from html tag', () => {
        expect(parseCharsetFromHtml('test <meta charset="utf-8" /> test')).toBe(DEFAULT_CHARSET);
        expect(parseCharsetFromHtml('test <meta charset="utf-8"/> test')).toBe(DEFAULT_CHARSET);
        expect(parseCharsetFromHtml('test <meta charset="utf-8" > test')).toBe(DEFAULT_CHARSET);
        expect(parseCharsetFromHtml('test <meta charset="utf-8"> test')).toBe(DEFAULT_CHARSET);
        expect(parseCharsetFromHtml('test <meta charset=utf-8> test')).toBe(DEFAULT_CHARSET);
        expect(parseCharsetFromHtml('test <META CHARSET=utf-8> test')).toBe(DEFAULT_CHARSET);
        expect(parseCharsetFromHtml('test <META CHARSET=UTF-8> test')).toBe(DEFAULT_CHARSET);

        expect(parseCharsetFromHtml('<meta http-equiv="content-type" content="text/html; charset=utf-8" />')).toBe(DEFAULT_CHARSET);
        expect(parseCharsetFromHtml('<meta http-equiv="Content-type" content="text/html; charset=utf-8" />')).toBe(DEFAULT_CHARSET);
        expect(parseCharsetFromHtml('<META HTTP-EQUIV="CONTENT-TYPE" content="text/html; charset=utf-8" />')).toBe(DEFAULT_CHARSET);
        expect(parseCharsetFromHtml('<META HTTP-EQUIV="CONTENT-TYPE" content="text/html;charset=utf-8" />')).toBe(DEFAULT_CHARSET);
        expect(parseCharsetFromHtml('<META HTTP-EQUIV=\'CONTENT-TYPE\' content="text/html;charset=utf-8" />')).toBe(DEFAULT_CHARSET);
        expect(parseCharsetFromHtml('<meta content="text/html; charset=utf-8" http-equiv="content-type" />')).toBe(DEFAULT_CHARSET);
    });

    it('checks parsing charset from css', () => {
        expect(parseCharsetFromCss('@charset "utf-8";')).toBe(DEFAULT_CHARSET);
        expect(parseCharsetFromCss('@charset "windows-1251";')).toBe(WIN_1251);
    });
});
