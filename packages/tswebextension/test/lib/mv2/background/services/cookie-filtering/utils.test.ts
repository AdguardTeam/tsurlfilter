import {
    describe,
    expect,
    beforeEach,
    it,
    vi,
} from 'vitest';

import { getResponseHeaders } from '../../fixtures/response-headers';
import CookieUtils from '../../../../../../src/lib/mv2/background/services/cookie-filtering/utils';
import { ParsedCookie } from '../../../../../../src/lib/common/cookie-filtering/parsed-cookie';

const TEST_URL = 'https://test.com/url';

vi.mock('../../../../../../src/lib/common/utils/logger');

describe('Cookie utils - Set-Cookie headers parsing', () => {
    it('checks parse simple', () => {
        let cookies: ParsedCookie[] = CookieUtils.parseSetCookieHeaders([], TEST_URL);
        expect(cookies).toHaveLength(0);

        cookies = CookieUtils.parseSetCookieHeaders([
            {
                name: 'set-cookie',
                value: 'ok',
            },
        ], TEST_URL);
        expect(cookies).toHaveLength(1);

        cookies = CookieUtils.parseSetCookieHeaders([
            {
                name: 'invalid',
                value: 'invalid',
            },
        ], TEST_URL);
        expect(cookies).toHaveLength(0);

        cookies = CookieUtils.parseSetCookieHeaders([
            {
                name: 'set-cookie',
                value: undefined,
            },
        ], TEST_URL);
        expect(cookies).toHaveLength(0);

        cookies = CookieUtils.parseSetCookieHeaders([
            {
                name: 'set-cookie',
                value: '',
            },
        ], TEST_URL);
        expect(cookies).toHaveLength(0);
    });

    it('checks parse hostname', () => {
        const HOSTNAME = 'test.domain.com';
        const PATH = '/';
        const THREE_LEVEL_DOMAIN = `https://${HOSTNAME}${PATH}`;

        const cookies = CookieUtils.parseSetCookieHeaders([{
            name: 'set-cookie',
            value: 'visitCount=3; Max-Age=2592000; Secure; HttpOnly; SameSite=Lax',
        }], THREE_LEVEL_DOMAIN);

        expect(cookies).toHaveLength(1);
        expect(cookies[0].name).toBe('visitCount');
        expect(cookies[0]!.value).toBe('3');
        expect(cookies[0].url).toBe(THREE_LEVEL_DOMAIN);
        expect(cookies[0].domain).toBeUndefined();
        expect(cookies[0].path).toBe(PATH);
    });
});

describe('Cookie utils - Set-Cookie parsing', () => {
    it('checks parse simple', () => {
        const cookie = CookieUtils.parseSetCookie('value=123', TEST_URL);
        expect(cookie).not.toBeNull();
        expect(cookie!.name).toBe('value');
        expect(cookie!.value).toBe('123');
        expect(cookie!.url).toBe(TEST_URL);
        expect(cookie!.domain).toBeUndefined();
    });

    it('checks parse complicated', () => {
        // eslint-disable-next-line max-len
        const cookie = CookieUtils.parseSetCookie('user_session=wBDJ5-apskjfjkas124192--e5; path=/; expires=Tue, 06 Nov 2018 12:57:11 -0000; secure; HttpOnly; SameSite=Lax; Max-Age=100', TEST_URL);
        expect(cookie).not.toBeNull();
        expect(cookie!.name).toBe('user_session');
        expect(cookie!.value).toBe('wBDJ5-apskjfjkas124192--e5');
        expect(cookie!.url).toBe(TEST_URL);
        expect(cookie!.domain).toBeUndefined();
    });

    it('parses cookie with domain', () => {
        const DOMAIN = 'test.com';

        const cookie = CookieUtils.parseSetCookie(`value=123; domain=${DOMAIN}`, TEST_URL);
        expect(cookie).not.toBeNull();
        expect(cookie!.name).toBe('value');
        expect(cookie!.value).toBe('123');
        expect(cookie!.url).toBe(TEST_URL);
        expect(cookie!.domain).toBe(DOMAIN);
    });

    it('parses cookie with path', () => {
        const cookie = CookieUtils.parseSetCookie(
            'sample-key=sample-value; path=/',
            TEST_URL,
        );
        expect(cookie!.name).toBe('sample-key');
        expect(cookie!.value).toBe('sample-value');
        expect(cookie!.path).toBe('/');

        const cookie2 = CookieUtils.parseSetCookie(
            'sample-key=sample-value; path=/login',
            TEST_URL,
        );
        expect(cookie2!.name).toBe('sample-key');
        expect(cookie2!.value).toBe('sample-value');
        expect(cookie2!.path).toBe('/login');
    });

    it('checks parse invalid', () => {
        let cookie = CookieUtils.parseSetCookie('', TEST_URL);
        expect(cookie).toBeNull();

        cookie = CookieUtils.parseSetCookie('empty', TEST_URL);
        expect(cookie).not.toBeNull();
        expect(cookie!.name).toBe('empty');
        expect(cookie!.value).toBe('');
    });
});

describe('Cookie utils - parsing cookies', () => {
    it('checks parse simple', () => {
        const cookies = CookieUtils.parseCookies('first_name=first_value;skip;second_name=second_value;', TEST_URL);
        expect(cookies).toHaveLength(2);
        expect(cookies[0].name).toBe('first_name');
        expect(cookies[0]!.value).toBe('first_value');
        expect(cookies[0].url).toBe(TEST_URL);
        expect(cookies[0].domain).toBeUndefined();
    });

    it('checks parse secure', () => {
        // eslint-disable-next-line max-len
        const cookies = CookieUtils.parseCookies('__Secure-first_name=first_value;skip;__Host-second_name=second_value;', TEST_URL);
        expect(cookies).toHaveLength(2);
        expect(cookies[0].name).toBe('__Secure-first_name');
        expect(cookies[0]!.value).toBe('first_value');
        expect(cookies[1]!.secure).toBe(true);
        expect(cookies[0].url).toBe(TEST_URL);
        expect(cookies[0].domain).toBeUndefined();
    });

    it('checks parse invalid', () => {
        const cookies = CookieUtils.parseCookies('', TEST_URL);
        expect(cookies).toHaveLength(0);
    });
});

describe('Cookie utils - update max age', () => {
    let cookie: ParsedCookie;

    beforeEach(() => {
        cookie = new ParsedCookie('test', 'test', TEST_URL);
    });

    it('checks update - max age', () => {
        cookie.maxAge = undefined;
        cookie.expires = undefined;

        expect(CookieUtils.updateCookieMaxAge(cookie, 1)).toBeTruthy();
        expect(cookie.maxAge).toBe(1);
        expect(cookie.expires).toBeDefined();
    });

    it('checks add - max age', () => {
        cookie.maxAge = 2;
        cookie.expires = undefined;

        expect(CookieUtils.updateCookieMaxAge(cookie, 1)).toBeTruthy();
        expect(cookie.maxAge).toBe(1);
        expect(cookie.expires).toBeDefined();
    });

    it('checks no update - max age', () => {
        cookie.maxAge = 1;
        cookie.expires = undefined;

        expect(CookieUtils.updateCookieMaxAge(cookie, 2)).toBeFalsy();
        expect(cookie.maxAge).toBe(1);
        expect(cookie.expires).not.toBeDefined();
    });

    it('checks add - expires', () => {
        cookie.maxAge = undefined;
        const date = new Date(new Date().getTime() + 5 * 1000);
        cookie.expires = date;

        expect(CookieUtils.updateCookieMaxAge(cookie, 2)).toBeTruthy();
        expect(cookie.maxAge).toBe(2);
        expect(cookie.expires).toBeDefined();
        expect(cookie.expires).not.toBe(date);
    });

    it('checks no update - expires', () => {
        cookie.maxAge = undefined;
        const date = new Date();
        cookie.expires = date;

        expect(CookieUtils.updateCookieMaxAge(cookie, 2)).toBeFalsy();
        expect(cookie.maxAge).not.toBeDefined();
        expect(cookie.expires).toBeDefined();
        expect(cookie.expires).toBe(date);
    });
});

describe('Cookie utils - serialize cookie', () => {
    it('throws error on invalid cookie', () => {
        const cookie = {
            name: 'привет',
            value: 'я_кука',
        };

        expect(() => {
            CookieUtils.serializeCookieToResponseHeader(cookie as ParsedCookie);
        }).toThrow(TypeError);
    });

    it('serializes simple cookie', () => {
        const cookie = {
            name: '_octo',
            value: 'GH1.1.635223982.1507661197',
        };

        const setCookieValue = CookieUtils.serializeCookieToResponseHeader(cookie as ParsedCookie);
        expect(setCookieValue).toBe('_octo=GH1.1.635223982.1507661197');
    });

    it('serializes complicated cookie', () => {
        const cookie = {
            name: '_octo',
            value: 'GH1.1.635223982.1507661197',
            path: '/',
            expires: new Date('Tue, 23 Oct 2018 13:40:11 -0000'),
            secure: true,
            httpOnly: true,
        };

        const setCookieValue = CookieUtils.serializeCookieToResponseHeader(cookie as ParsedCookie);
        expect(setCookieValue)
            .toBe('_octo=GH1.1.635223982.1507661197; Path=/; Expires=Tue, 23 Oct 2018 13:40:11 GMT; HttpOnly; Secure');
    });
});

describe('Cookie utils - splitMultilineCookies', () => {
    const MULTILINE_COOKIE_HEADER = {
        name: 'set-cookie',
        // eslint-disable-next-line max-len
        value: 'dwac_beJKsiaagurPYaaadbVLZSmGcd=x29CbV1wh5hgR6skMQkC_JQIylx4LpAjnkw%3D|dw-only|||EUR|false|Europe%2FBerlin|true; Path=/; Secure; SameSite=None\nsid=x29CbV1wh5hgR6skMQkC_JQIylx4LpAjnkw; Path=/; Secure; SameSite=None\n__cq_dnt=0; Path=/; Secure; SameSite=None\ndw_dnt=0; Path=/; Secure; SameSite=None\n__cf_bm=Ul3s_twxhCUYID4W90IHl2txSLb4sOSq0SwlQ4BSW9g-1709212297-1.0-AXjt6hn9UjCnbvFTW7CIfjHMzkcu7HZ6FWgGYzc2UVYnwKplwwEoIBp8994KcnLlxPxzquO4UAEdh4nHzh0r4ug=; path=/; expires=Thu, 29-Feb-24 13:41:37 GMT; domain=.eu.puma.com; HttpOnly; Secure; SameSite=None',
    };

    const MULTILINE_COOKIES_COUNT = 5;

    const SINGLE_LINE_COOKIE = {
        name: 'set-cookie',
        value: 'sid=x29CbV1wh5hgR6skMQkC_JQIylx4LpAjnkw; Path=/; Secure; SameSite=None',
    };

    it('splits single `set-cookie` header into multiple', () => {
        let responseHeaders = [...getResponseHeaders(), MULTILINE_COOKIE_HEADER];
        const initialLength = responseHeaders.length;

        CookieUtils.splitMultilineCookies(responseHeaders);

        // One set-cookie header should be converted into multiple
        expect(responseHeaders.length).toBe(initialLength + MULTILINE_COOKIES_COUNT - 1);
        // Resulting cookies are parsable
        expect(CookieUtils.parseSetCookieHeaders(responseHeaders, 'https://example.org')).toHaveLength(MULTILINE_COOKIES_COUNT);

        // Change `set-cookie` header placement
        responseHeaders = [MULTILINE_COOKIE_HEADER, ...getResponseHeaders()];
        CookieUtils.splitMultilineCookies(responseHeaders);
        expect(responseHeaders.length).toBe(initialLength + MULTILINE_COOKIES_COUNT - 1);
        expect(CookieUtils.parseSetCookieHeaders(responseHeaders, 'https://example.org')).toHaveLength(MULTILINE_COOKIES_COUNT);
    });

    it('does nothing for a single line `set-cookie` headers or any other', () => {
        const responseHeaders = [...getResponseHeaders(), SINGLE_LINE_COOKIE];
        const initialLength = responseHeaders.length;

        CookieUtils.splitMultilineCookies(responseHeaders);

        expect(responseHeaders.length).toBe(initialLength);
        expect(CookieUtils.parseSetCookieHeaders(responseHeaders, 'https://example.org')).toHaveLength(1);
    });
});
