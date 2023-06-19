import console from 'console';
import { parseOptionsString } from '../../src/utils/parse-options-string';

describe('parseOptionsString', () => {
    it('parses basic options', () => {
        // Parses single option
        let str = 'domain=example.com';
        let expected = ['domain=example.com'];
        let result = parseOptionsString(str);
        expect(result).toEqual(expected);

        // Parses single non-value option
        str = 'match-case';
        expected = ['match-case'];
        result = parseOptionsString(str);
        expect(result).toEqual(expected);

        // Parses with special characters in values
        str = 'header=set-cookie:foo,match-case,denyallow=x.com|y.com';
        expected = ['header=set-cookie:foo', 'match-case', 'denyallow=x.com|y.com'];
        result = parseOptionsString(str);
        expect(result).toEqual(expected);

        // Parses mixed options
        str = 'image,media,other,domain=a.com|b.com,path=/page*.html';
        expected = ['image', 'media', 'other', 'domain=a.com|b.com', 'path=/page*.html'];
        result = parseOptionsString(str);
        expect(result).toEqual(expected);
    });

    it('parses $removeparam correctly', () => {
        // Parses plain value
        let str = 'removeparam=param';
        let expected = ['removeparam=param'];
        let result = parseOptionsString(str);
        expect(result).toEqual(expected);

        // Parses regexp syntax with unescaped comma
        str = 'removeparam=/^kk=w{3,}$/gi';
        expected = ['removeparam=/^kk=w{3,}$/gi'];
        result = parseOptionsString(str);
        expect(result).toEqual(expected);

        // Parses $removeparam along other options
        str = 'domain=a.com|b.com,removeparam=/^kk=w{3,}$/gi,denyallow=x.com|y.com';
        expected = ['domain=a.com|b.com', 'removeparam=/^kk=w{3,}$/gi', 'denyallow=x.com|y.com'];
        result = parseOptionsString(str);
        expect(result).toEqual(expected);

        // Parses non-paired forward slashes correctly
        str = 'removeparam=/^kk=w{3,}$/,path=/page,domain=a.com|b.com';
        expected = ['removeparam=/^kk=w{3,}$/', 'path=/page', 'domain=a.com|b.com'];
        result = parseOptionsString(str);
        expect(result).toEqual(expected);
    });

    it('parses $replace correctly', () => {
        // Parses with unescaped comma and flags
        let str = 'replace=/w{3,}/test/gi';
        let expected = ['replace=/w{3,}/test/gi'];
        let result = parseOptionsString(str);
        expect(result).toEqual(expected);

        // Parses $replace along other options
        str = 'domain=a.com|b.com,replace=/w{3,}/test/gi,denyallow=x.com|y.com';
        expected = ['domain=a.com|b.com', 'replace=/w{3,}/test/gi', 'denyallow=x.com|y.com'];
        result = parseOptionsString(str);
        expect(result).toEqual(expected);

        // Parses non-paired forward slashes correctly
        str = 'replace=/w{3,}/test/gi,path=/page,domain=a.com|b.com';
        expected = ['replace=/w{3,}/test/gi', 'path=/page', 'domain=a.com|b.com'];
        result = parseOptionsString(str);
        expect(result).toEqual(expected);

        // Parses with escapes in regex
        /* eslint-disable no-useless-escape */
        str = 'replace=/(remove ")[\s\S]*(" from string)/\$1\$2/';
        expected = ['replace=/(remove ")[\s\S]*(" from string)/\$1\$2/'];
        /* eslint-enable no-useless-escape */
        result = parseOptionsString(str);
        expect(result).toEqual(expected);
    });

    it('parses $hls correctly', () => {
        // Escaped comma in rule modifier value stays escaped
        const optionsPart = String.raw`hls=/#UPLYNK-SEGMENT:.*\,ad/t`;
        const expected = [String.raw`hls=/#UPLYNK-SEGMENT:.*\,ad/t`];
        const actual = parseOptionsString(optionsPart);
        expect(actual).toEqual(expected);
    });

    it('works with edge cases', () => {
        // Parses options when both $removeparam and $replace are present
        let str = 'path=/page.html,removeparam=/^kk=w{3,}$/,domain=a.com|b.com,replace=/w{3,}/test/gi';
        let expected = ['path=/page.html', 'removeparam=/^kk=w{3,}$/', 'domain=a.com|b.com', 'replace=/w{3,}/test/gi'];
        let result = parseOptionsString(str);
        expect(result).toEqual(expected);

        // Parses, while removing escape characters
        str = 'cookie=qwe\\,rty;maxAge=3600;sameSite=lax';
        expected = ['cookie=qwe,rty;maxAge=3600;sameSite=lax'];
        result = parseOptionsString(str, true);
        expect(result).toEqual(expected);

        // Parses, while keeping escape characters
        str = 'cookie=qwe\\,rty;maxAge=3600;sameSite=lax';
        expected = ['cookie=qwe\\,rty;maxAge=3600;sameSite=lax'];
        result = parseOptionsString(str, false);
        expect(result).toEqual(expected);
    });

    it('throws on invalid modifier or its value', () => {
        expect(() => {
            parseOptionsString('replace=/test1/test2/test3/g');
        }).toThrowError('Invalid pattern for regexp modifier value.');

        expect(() => {
            parseOptionsString('replace=/test1/tes,t2/g');
        }).toThrowError('Unexpected options delimiter or end of options string.');

        expect(() => {
            parseOptionsString('removeparam=/test1');
        }).toThrowError('Invalid $removeparam modifier value.');
    });

    it('measures parseOptionsString', async () => {
        const startParse = Date.now();

        let count = 0;
        while (count < 2000) {
            count += 1;

            let str = 'cookie=qwe\\,rty;maxAge=3600;sameSite=lax';
            let expected = ['cookie=qwe,rty;maxAge=3600;sameSite=lax'];
            let result = parseOptionsString(str, true);
            expect(result).toEqual(expected);

            str = 'cookie=qwe\\,rty;maxAge=3600;sameSite=lax';
            expected = ['cookie=qwe\\,rty;maxAge=3600;sameSite=lax'];
            result = parseOptionsString(str, false);
            expect(result).toEqual(expected);
        }

        console.log(`Elapsed time: ${Date.now() - startParse}`);
    });
});
