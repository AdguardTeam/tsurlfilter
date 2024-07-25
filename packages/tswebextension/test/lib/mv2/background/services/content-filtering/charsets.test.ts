import {
    DEFAULT_CHARSET,
    parseCharsetFromCss,
    parseCharsetFromHeader,
    parseCharsetFromHtml,
    WIN_1251,
} from '../../../../../../src/lib/mv2/background/services/content-filtering/charsets';

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
     * <meta content="text/html; charset=utf-8" http-equiv="Content-type" />.
     */
    describe('checks parsing charset from html tag', () => {
        const table = [
            ['test <meta charset="utf-8" /> test', DEFAULT_CHARSET],
            ['test <meta charset="utf-8"/> test', DEFAULT_CHARSET],
            ['test <meta charset="utf-8" > test', DEFAULT_CHARSET],
            ['test <meta charset="utf-8"> test', DEFAULT_CHARSET],
            ['test <meta charset=utf-8> test', DEFAULT_CHARSET],
            ['test <META CHARSET=utf-8> test', DEFAULT_CHARSET],
            ['test <META CHARSET=UTF-8> test', DEFAULT_CHARSET],
            ['<meta http-equiv="content-type" content="text/html; charset=utf-8" />', DEFAULT_CHARSET],
            ['<meta http-equiv="Content-type" content="text/html; charset=utf-8" />', DEFAULT_CHARSET],
            ['<META HTTP-EQUIV="CONTENT-TYPE" content="text/html; charset=utf-8" />', DEFAULT_CHARSET],
            ['<META HTTP-EQUIV="CONTENT-TYPE" content="text/html;charset=utf-8" />', DEFAULT_CHARSET],
            ['<META HTTP-EQUIV=\'CONTENT-TYPE\' content="text/html;charset=utf-8" />', DEFAULT_CHARSET],
            ['<meta content="text/html; charset=utf-8" http-equiv="content-type" />', DEFAULT_CHARSET],
        ];

        test.each(table)('parseCharsetFromHtml(\'%s\')', (html, expected) => {
            expect(parseCharsetFromHtml(html)).toBe(expected);
        });
    });

    it('checks parsing charset from css', () => {
        expect(parseCharsetFromCss('@charset "utf-8";')).toBe(DEFAULT_CHARSET);
        expect(parseCharsetFromCss('@charset "windows-1251";')).toBe(WIN_1251);
    });
});
