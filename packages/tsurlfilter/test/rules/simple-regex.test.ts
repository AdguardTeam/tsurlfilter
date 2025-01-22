import { SimpleRegex } from '../../src/rules/simple-regex';

describe('SimpleRegex.patternToRegexp', () => {
    it('works if simple pattern is transformed properly', () => {
        const regex = SimpleRegex.patternToRegexp('||example.org^');
        const expected = `${SimpleRegex.REGEX_START_URL}example\\.org${SimpleRegex.REGEX_SEPARATOR}`;
        expect(regex).toEqual(expected);
    });

    it('works if pipes are transformed properly', () => {
        const regex = SimpleRegex.patternToRegexp('|https://example.org|');
        const expected = `${SimpleRegex.REGEX_START_STRING}https:\\/\\/example\\.org${SimpleRegex.REGEX_END_STRING}`;
        expect(regex).toEqual(expected);
    });

    it('works if separator and any characters are transformed properly', () => {
        const regex = SimpleRegex.patternToRegexp('|https://example.org/[*]^');
        // eslint-disable-next-line max-len
        const expected = `${SimpleRegex.REGEX_START_STRING}https:\\/\\/example\\.org\\/\\[${SimpleRegex.REGEX_ANY_CHARACTER}\\]${SimpleRegex.REGEX_SEPARATOR}`;
        expect(regex).toEqual(expected);
    });

    it('works if regex pattern is properly transformed', () => {
        const regex = SimpleRegex.patternToRegexp('/(example)+\\.org/');
        const expected = '(example)+\\.org';
        expect(regex).toEqual(expected);
    });

    it('works if detects "any character" patterns properly', () => {
        const regex = SimpleRegex.patternToRegexp('||');
        const expected = '.*';
        expect(regex).toEqual(expected);
    });
});

describe('SimpleRegex.extractShortcut', () => {
    it('works if it is able to extract basic shortcuts', () => {
        let shortcut = SimpleRegex.extractShortcut('||example.org^');
        expect(shortcut).toEqual('example.org');

        shortcut = SimpleRegex.extractShortcut('|https://*examp');
        expect(shortcut).toEqual('https://');

        shortcut = SimpleRegex.extractShortcut('|https://*example.org/path');
        expect(shortcut).toEqual('example.org/path');
    });

    it('works if it is able to extract regex shortcuts', () => {
        let shortcut: string;

        shortcut = SimpleRegex.extractShortcut('/example/');
        expect(shortcut).toEqual('example');

        shortcut = SimpleRegex.extractShortcut('/^http:\\/\\/example/');
        expect(shortcut).toEqual('example');

        shortcut = SimpleRegex.extractShortcut('/^http:\\/\\/[a-z]+\\.example/');
        expect(shortcut).toEqual('.example');

        shortcut = SimpleRegex.extractShortcut('/(https:\\/\\/)142\\.91\\.159\\..{100,}/');
        expect(shortcut).toEqual('142.91.159.');

        shortcut = SimpleRegex.extractShortcut('/(https?:\\/\\/)142\\.91\\.159\\..{100,}/');
        expect(shortcut).toEqual('');

        shortcut = SimpleRegex.extractShortcut('/^https:\\/\\/sm\\.l/');
        expect(shortcut).toEqual('sm.l');

        shortcut = SimpleRegex.extractShortcut('/https://reg\\.com/');
        expect(shortcut).toEqual('reg.com');

        // dots are not escaped - they considered as any character here
        shortcut = SimpleRegex.extractShortcut(String.raw`/api.github.com\/\w{5}\/AdguardTeam/`);
        expect(shortcut).toEqual('/adguardteam');

        // dots are escaped - they considered as dots
        // named predefined character class
        shortcut = SimpleRegex.extractShortcut(String.raw`/api\.github\.com\/\w{5}\/AdguardTeam/`);
        expect(shortcut).toEqual('api.github.com/');

        // custom character class, but actually the same as \w
        shortcut = SimpleRegex.extractShortcut(String.raw`/api\.github\.com\/[A-Za-z0-9_]{5}\/AdguardTeam/`);
        expect(shortcut).toEqual('api.github.com/');

        shortcut = SimpleRegex.extractShortcut(String.raw`/[a-z0-9]{32,}\.js/`);
        expect(shortcut).toEqual('.js');

        shortcut = SimpleRegex.extractShortcut(String.raw`/[a-z0-9]{32,}.js/`);
        expect(shortcut).toEqual('js');

        // zero-length alternative regexp case
        // https://github.com/AdguardTeam/AdguardBrowserExtension/issues/2240#issuecomment-1344807910
        shortcut = SimpleRegex.extractShortcut(
            // eslint-disable-next-line no-useless-escape
            '/^http(s|):\/\/([a-z0-9-\.]+|)+[a-z0-9-]+\.[a-z]+\/adManager\/(css|js)\/[A-z]+\.(css|js)$/',
        );
        expect(shortcut).toEqual('admanager');
    });

    it('works if it discards incorrect patterns', () => {
        let shortcut = SimpleRegex.extractShortcut('//');
        expect(shortcut).toEqual('');

        shortcut = SimpleRegex.extractShortcut('/^http:\\/\\/[a-z]?example.org/');
        expect(shortcut).toEqual('');

        shortcut = SimpleRegex.extractShortcut('/^http:\\/\\/(!?test.)example.org/');
        expect(shortcut).toEqual('');

        shortcut = SimpleRegex.extractShortcut('/^http:\\/\\/(!?test.)example.org/');
        expect(shortcut).toEqual('');
    });
});

describe('SimpleRegex.patternFromString', () => {
    it('works if it is able to creates basic regexp', () => {
        expect(SimpleRegex.patternFromString('/test/').source).toBe('test');
        expect(SimpleRegex.patternFromString('/test/gi').source).toBe('test');
    });
});

describe('SimpleRegex.escapeRegexSpecials', () => {
    it('escapes specials in strings', () => {
        expect(SimpleRegex.escapeRegexSpecials('*entries*')).toBe('\\*entries\\*');
        expect(SimpleRegex.escapeRegexSpecials('[test]')).toBe('\\[test\\]');
        expect(SimpleRegex.escapeRegexSpecials(
            '[*test*]',
            SimpleRegex.reModifierPatternSpecialCharacters,
        )).toBe('\\[*test*\\]');
    });
});

describe('SimpleRegex.unescapeRegexSpecials', () => {
    it('unescapes specials in strings', () => {
        expect(SimpleRegex.unescapeRegexSpecials('\\*entries\\*')).toBe('*entries*');
        expect(SimpleRegex.unescapeRegexSpecials('\\[test\\]')).toBe('[test]');
        expect(SimpleRegex.unescapeRegexSpecials(
            '\\[\\*test\\*\\]',
            SimpleRegex.reModifierPatternEscapedSpecialCharacters,
        )).toBe('[\\*test\\*]');
    });
});

describe('SimpleRegex.isRegexPattern', () => {
    it('checks if pattern is Regex', () => {
        expect(SimpleRegex.isRegexPattern('/path.html/')).toBe(true);
        expect(SimpleRegex.isRegexPattern('/path.html')).toBe(false);
        expect(SimpleRegex.isRegexPattern('path.html')).toBe(false);
    });
});
