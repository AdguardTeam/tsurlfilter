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
        let shortcut = SimpleRegex.extractShortcut('/example/');
        expect(shortcut).toEqual('example');

        shortcut = SimpleRegex.extractShortcut('/^http:\\/\\/example/');
        expect(shortcut).toEqual('/example');

        shortcut = SimpleRegex.extractShortcut('/^http:\\/\\/[a-z]+\\.example/');
        expect(shortcut).toEqual('.example');

        shortcut = SimpleRegex.extractShortcut('/(https?:\\/\\/)142\\.91\\.159\\..{100,}/');
        expect(shortcut).toEqual('142.91.159.');
    });

    it('works if it discards incorrect patterns', () => {
        let shortcut = SimpleRegex.extractShortcut('//');
        expect(shortcut).toEqual('');

        shortcut = SimpleRegex.extractShortcut('/^http:\\/\\/[a-z]?example.org/');
        expect(shortcut).toEqual('example.org');

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
    });
});
