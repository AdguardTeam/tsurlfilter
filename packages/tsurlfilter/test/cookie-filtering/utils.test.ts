import CookieUtils from '../../src/cookie-filtering/utils';
import ParsedCookie from '../../src/cookie-filtering/parsed-cookie';

const TEST_URL = 'https://test.com/url';

describe('Cookie utils - Set-Cookie headers parsing', () => {
    it('checks parse simple', () => {
        let cookies = CookieUtils.parseSetCookieHeaders([], TEST_URL);
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
});

describe('Cookie utils - Set-Cookie parsing', () => {
    it('checks parse simple', () => {
        const cookie = CookieUtils.parseSetCookie('value=123', TEST_URL);
        expect(cookie).not.toBeNull();
        expect(cookie!.name).toBe('value');
        expect(cookie!.value).toBe('123');
        expect(cookie!.url).toBe(TEST_URL);
        expect(cookie!.domain).toBe('test.com');
    });

    it('checks parse complicated', () => {
        // eslint-disable-next-line max-len
        const cookie = CookieUtils.parseSetCookie('user_session=wBDJ5-apskjfjkas124192--e5; path=/; expires=Tue, 06 Nov 2018 12:57:11 -0000; secure; HttpOnly; SameSite=Lax; Max-Age=100', TEST_URL);
        expect(cookie).not.toBeNull();
        expect(cookie!.name).toBe('user_session');
        expect(cookie!.value).toBe('wBDJ5-apskjfjkas124192--e5');
        expect(cookie!.url).toBe(TEST_URL);
        expect(cookie!.domain).toBe('test.com');
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
        expect(cookies[0].domain).toBe('test.com');
    });

    it('checks parse secure', () => {
        // eslint-disable-next-line max-len
        const cookies = CookieUtils.parseCookies('__Secure-first_name=first_value;skip;__Host-second_name=second_value;', TEST_URL);
        expect(cookies).toHaveLength(2);
        expect(cookies[0].name).toBe('__Secure-first_name');
        expect(cookies[0]!.value).toBe('first_value');
        expect(cookies[1]!.secure).toBe(true);
        expect(cookies[0].url).toBe(TEST_URL);
        expect(cookies[0].domain).toBe('test.com');
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
            CookieUtils.serializeCookie(cookie as ParsedCookie);
        }).toThrow(TypeError);
    });

    it('serializes simple cookie', () => {
        const cookie = {
            name: '_octo',
            value: 'GH1.1.635223982.1507661197',
        };

        const setCookieValue = CookieUtils.serializeCookie(cookie as ParsedCookie);
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

        const setCookieValue = CookieUtils.serializeCookie(cookie as ParsedCookie);
        expect(setCookieValue)
            .toBe('_octo=GH1.1.635223982.1507661197; Path=/; Expires=Tue, 23 Oct 2018 13:40:11 GMT; HttpOnly; Secure');
    });
});
