import { EMPTY, ESCAPE_CHARACTER, SPACE } from '../../src/utils/constants';
import { StringUtils } from '../../src/utils/string';

describe('String utils', () => {
    test('findNextUnescapedCharacter', () => {
        expect(StringUtils.findNextUnescapedCharacter(' \\,\\, , ,', ',')).toEqual(6);
        expect(StringUtils.findNextUnescapedCharacter(' \\,\\, , ,', ',', 7)).toEqual(8);

        expect(StringUtils.findNextUnescapedCharacter(EMPTY, ',')).toEqual(-1);
        expect(StringUtils.findNextUnescapedCharacter(SPACE, ',')).toEqual(-1);
    });

    test('findLastUnescapedCharacter', () => {
        expect(StringUtils.findLastUnescapedCharacter('aaa\\a\\aa', 'a')).toEqual(7);
        expect(StringUtils.findLastUnescapedCharacter(EMPTY, 'a')).toEqual(-1);
    });

    test('findNextUnescapedCharacterThatNotFollowedBy', () => {
        expect(StringUtils.findNextUnescapedCharacterThatNotFollowedBy('$\\$\\$$f$ok', 0, '$', 'f')).toEqual(0);
        expect(StringUtils.findNextUnescapedCharacterThatNotFollowedBy('/^regexp$/$m=v', 0, '$', '/')).toEqual(10);
        expect(StringUtils.findNextUnescapedCharacterThatNotFollowedBy(EMPTY, 0, '$', '/')).toEqual(-1);
    });

    test('findLastUnescapedCharacterThatNotFollowedBy', () => {
        expect(StringUtils.findLastUnescapedCharacterThatNotFollowedBy('$\\$\\$$f$ok', '$', 'f')).toEqual(7);
        expect(StringUtils.findLastUnescapedCharacterThatNotFollowedBy(EMPTY, '$', '/')).toEqual(-1);
    });

    test('findUnescapedNonStringNonRegexChar', () => {
        expect(StringUtils.findUnescapedNonStringNonRegexChar('\'aa\\a\' "aaa" /aaa/ a', 'a')).toEqual(19);

        expect(StringUtils.findUnescapedNonStringNonRegexChar('\'aa\\a\' "aaa" /aaa/ \\a   a', 'a')).toEqual(24);

        expect(StringUtils.findUnescapedNonStringNonRegexChar('\'aa\\a\' "aaa" /aaa/ /a/', 'a')).toEqual(-1);
        expect(StringUtils.findUnescapedNonStringNonRegexChar('\'aa\\a\' "a\'aa" /a\'a\'a/ /a/', 'a')).toEqual(-1);
        expect(StringUtils.findUnescapedNonStringNonRegexChar(EMPTY, 'a')).toEqual(-1);
    });

    test('findNextUnquotedUnescapedCharacter', () => {
        // works with valid input
        const testString = '"a,b",\'c,d\',\'e\'';

        expect(StringUtils.findNextUnquotedUnescapedCharacter(testString, ',')).toEqual(5);
        expect(StringUtils.findNextUnquotedUnescapedCharacter(testString, ',', 6)).toEqual(11);

        // no unquoted
        expect(StringUtils.findNextUnquotedUnescapedCharacter("'a,b'", ',')).toEqual(-1);
        expect(StringUtils.findNextUnquotedUnescapedCharacter('"a,b"', ',')).toEqual(-1);

        // empty strings
        expect(StringUtils.findNextUnquotedUnescapedCharacter(EMPTY, ',')).toEqual(-1);
        expect(StringUtils.findNextUnquotedUnescapedCharacter(SPACE, ',')).toEqual(-1);
    });

    test('findNextNotBracketedUnescapedCharacter', () => {
        expect(StringUtils.findNextNotBracketedUnescapedCharacter('(a,b,c),(a,b,c)', ',')).toEqual(7);
        expect(StringUtils.findNextNotBracketedUnescapedCharacter('(a,b,c)\\,(a,b,c),(a)', ',')).toEqual(16);

        // empty strings
        expect(StringUtils.findNextNotBracketedUnescapedCharacter(EMPTY, ',')).toEqual(-1);
        expect(StringUtils.findNextNotBracketedUnescapedCharacter(SPACE, ',')).toEqual(-1);

        // invalid
        // eslint-disable-next-line max-len
        expect(() => StringUtils.findNextNotBracketedUnescapedCharacter(EMPTY, ',', 0, ESCAPE_CHARACTER, '(', '(')).toThrowError('Open and close bracket cannot be the same');
    });

    test('splitStringByUnquotedUnescapedCharacter', () => {
        expect(StringUtils.splitStringByUnquotedUnescapedCharacter('', '|')).toEqual(['']);

        expect(StringUtils.splitStringByUnquotedUnescapedCharacter('  ', '|')).toEqual(['  ']);

        expect(StringUtils.splitStringByUnquotedUnescapedCharacter('\'aa|bb\' "aaa | bb" \\|\\| | bbb', '|')).toEqual([
            '\'aa|bb\' "aaa | bb" \\|\\| ',
            ' bbb',
        ]);

        // eslint-disable-next-line max-len
        expect(StringUtils.splitStringByUnquotedUnescapedCharacter('\'aa|bb\' "aaa | bb" \\|\\| | bbb|ccc', '|')).toEqual(
            ['\'aa|bb\' "aaa | bb" \\|\\| ', ' bbb', 'ccc'],
        );

        // eslint-disable-next-line max-len
        expect(StringUtils.splitStringByUnquotedUnescapedCharacter('\'aa|bb\' "aaa | bb" \\|\\| \\| bbb', '|')).toEqual([
            '\'aa|bb\' "aaa | bb" \\|\\| \\| bbb',
        ]);
    });

    test('splitStringByUnescapedNonStringNonRegexChar', () => {
        expect(StringUtils.splitStringByUnescapedNonStringNonRegexChar('', '|')).toEqual(['']);

        expect(StringUtils.splitStringByUnescapedNonStringNonRegexChar('  ', '|')).toEqual(['  ']);

        expect(
            StringUtils.splitStringByUnescapedNonStringNonRegexChar('\'aa|bb\' "aaa | bb" \\|\\| /aa|bb/ | bbb', '|'),
        ).toEqual(['\'aa|bb\' "aaa | bb" \\|\\| /aa|bb/ ', ' bbb']);

        expect(
            // eslint-disable-next-line max-len
            StringUtils.splitStringByUnescapedNonStringNonRegexChar('\'aa|bb\' "aaa | bb" \\|\\| /aa|bb/ | bbb|ccc', '|'),
        ).toEqual(['\'aa|bb\' "aaa | bb" \\|\\| /aa|bb/ ', ' bbb', 'ccc']);

        expect(
            StringUtils.splitStringByUnescapedNonStringNonRegexChar('\'aa|bb\' "aaa | bb" \\|\\| \\| bbb', '|'),
        ).toEqual(['\'aa|bb\' "aaa | bb" \\|\\| \\| bbb']);
    });

    test('isWhitespace', () => {
        expect(StringUtils.isWhitespace('')).toEqual(false);
        expect(StringUtils.isWhitespace('a')).toEqual(false);

        expect(StringUtils.isWhitespace(' ')).toEqual(true);
        expect(StringUtils.isWhitespace('\t')).toEqual(true);
    });

    test('isDigit', () => {
        expect(StringUtils.isDigit('')).toEqual(false);
        expect(StringUtils.isDigit('a')).toEqual(false);

        for (let i = 0; i < 10; i += 1) {
            expect(StringUtils.isDigit(String.fromCharCode(48 + i))).toEqual(true);
        }
    });

    test('isSmallLetter', () => {
        expect(StringUtils.isSmallLetter('')).toEqual(false);

        // Exclude capital letters
        for (let i = 0; i < 26; i += 1) {
            expect(StringUtils.isSmallLetter(String.fromCharCode(65 + i))).toEqual(false);
        }

        for (let i = 0; i < 26; i += 1) {
            expect(StringUtils.isSmallLetter(String.fromCharCode(97 + i))).toEqual(true);
        }
    });

    test('isCapitalLetter', () => {
        expect(StringUtils.isCapitalLetter('')).toEqual(false);

        // Exclude small letters
        for (let i = 0; i < 26; i += 1) {
            expect(StringUtils.isCapitalLetter(String.fromCharCode(97 + i))).toEqual(false);
        }

        for (let i = 0; i < 26; i += 1) {
            expect(StringUtils.isCapitalLetter(String.fromCharCode(65 + i))).toEqual(true);
        }
    });

    test('isAlphaNumeric', () => {
        expect(StringUtils.isAlphaNumeric('')).toEqual(false);
        expect(StringUtils.isAlphaNumeric(' ')).toEqual(false);

        for (let i = 0; i < 10; i += 1) {
            expect(StringUtils.isAlphaNumeric(String.fromCharCode(48 + i))).toEqual(true);
        }

        for (let i = 0; i < 26; i += 1) {
            expect(StringUtils.isAlphaNumeric(String.fromCharCode(65 + i))).toEqual(true);
        }

        for (let i = 0; i < 26; i += 1) {
            expect(StringUtils.isAlphaNumeric(String.fromCharCode(97 + i))).toEqual(true);
        }
    });

    test('splitStringByUnescapedCharacter', () => {
        expect(StringUtils.splitStringByUnescapedCharacter('', '|')).toEqual(['']);

        expect(StringUtils.splitStringByUnescapedCharacter('  ', '|')).toEqual(['  ']);

        expect(StringUtils.splitStringByUnescapedCharacter('aaaa\\|bbbb\\|\\|ccc\\|\\|\\\\|dddd|eeee', '|')).toEqual([
            'aaaa\\|bbbb\\|\\|ccc\\|\\|\\\\|dddd',
            'eeee',
        ]);

        expect(
            StringUtils.splitStringByUnescapedCharacter('aaaa\\|bbbb\\|\\|ccc\\|\\|\\\\|dddd|eeee|\'ffff\'', '|'),
        ).toEqual(['aaaa\\|bbbb\\|\\|ccc\\|\\|\\\\|dddd', 'eeee', '\'ffff\'']);

        expect(StringUtils.splitStringByUnescapedCharacter('aaaa\\|bbbb\\|\\|ccc\\|\\|\\\\|dddd\\|eeee', '|')).toEqual([
            'aaaa\\|bbbb\\|\\|ccc\\|\\|\\\\|dddd\\|eeee',
        ]);
    });

    test('findFirstNonWhitespaceCharacter', () => {
        expect(StringUtils.findFirstNonWhitespaceCharacter('')).toEqual(-1);
        expect(StringUtils.findFirstNonWhitespaceCharacter('  ')).toEqual(-1);
        expect(StringUtils.findFirstNonWhitespaceCharacter('a')).toEqual(0);
        expect(StringUtils.findFirstNonWhitespaceCharacter(' a')).toEqual(1);
        expect(StringUtils.findFirstNonWhitespaceCharacter(' a b')).toEqual(1);
        expect(StringUtils.findFirstNonWhitespaceCharacter('     a b c')).toEqual(5);
    });

    test('findLastNonWhitespaceCharacter', () => {
        expect(StringUtils.findLastNonWhitespaceCharacter('')).toEqual(-1);
        expect(StringUtils.findLastNonWhitespaceCharacter('  ')).toEqual(-1);
        expect(StringUtils.findLastNonWhitespaceCharacter('a')).toEqual(0);
        expect(StringUtils.findLastNonWhitespaceCharacter(' a')).toEqual(1);
        expect(StringUtils.findLastNonWhitespaceCharacter(' a b')).toEqual(3);
        expect(StringUtils.findLastNonWhitespaceCharacter('     a b c')).toEqual(9);
    });

    test('escapeCharacter', () => {
        expect(StringUtils.escapeCharacter('', 'b')).toBe('');
        expect(StringUtils.escapeCharacter('b', 'b')).toBe('\\b');
        expect(StringUtils.escapeCharacter('\\b', 'b')).toBe('\\b');
    });

    test('splitStringByNewLines', () => {
        expect(StringUtils.splitStringByNewLines('')).toStrictEqual(['']);
        expect(StringUtils.splitStringByNewLines('a\nb\nc')).toStrictEqual(['a', 'b', 'c']);
        expect(StringUtils.splitStringByNewLines('a\r\nb\nc')).toStrictEqual(['a', 'b', 'c']);
    });

    test('splitStringByNewLinesEx', () => {
        expect(StringUtils.splitStringByNewLinesEx(EMPTY)).toStrictEqual([[EMPTY, null]]);

        expect(StringUtils.splitStringByNewLinesEx('a\nb\nc')).toStrictEqual([
            ['a', 'lf'],
            ['b', 'lf'],
            ['c', null],
        ]);

        expect(StringUtils.splitStringByNewLinesEx('a\r\nb\nc')).toStrictEqual([
            ['a', 'crlf'],
            ['b', 'lf'],
            ['c', null],
        ]);

        expect(StringUtils.splitStringByNewLinesEx('a\r\nb\nc\n')).toStrictEqual([
            ['a', 'crlf'],
            ['b', 'lf'],
            ['c', 'lf'],
        ]);

        expect(StringUtils.splitStringByNewLinesEx('a\r\nb\nc\rd\n\n')).toStrictEqual([
            ['a', 'crlf'],
            ['b', 'lf'],
            ['c', 'cr'],
            ['d', 'lf'],
            [EMPTY, 'lf'],
        ]);
    });

    test('mergeStringByNewLines', () => {
        expect(StringUtils.mergeStringByNewLines(StringUtils.splitStringByNewLinesEx(EMPTY))).toEqual(EMPTY);

        expect(StringUtils.mergeStringByNewLines(StringUtils.splitStringByNewLinesEx('a\nb\nc'))).toEqual('a\nb\nc');

        expect(StringUtils.mergeStringByNewLines(StringUtils.splitStringByNewLinesEx('a\r\nb\nc'))).toEqual(
            'a\r\nb\nc',
        );

        expect(StringUtils.mergeStringByNewLines(StringUtils.splitStringByNewLinesEx('a\r\nb\nc\n'))).toEqual(
            'a\r\nb\nc\n',
        );

        expect(StringUtils.mergeStringByNewLines(StringUtils.splitStringByNewLinesEx('a\r\nb\nc\rd\n\n'))).toEqual(
            'a\r\nb\nc\rd\n\n',
        );
    });

    test('findNextWhitespaceCharacter', () => {
        expect(StringUtils.findNextWhitespaceCharacter('')).toBe(0);
        expect(StringUtils.findNextWhitespaceCharacter('  ')).toBe(0);
        expect(StringUtils.findNextWhitespaceCharacter('a')).toBe(1);
        expect(StringUtils.findNextWhitespaceCharacter(' a')).toBe(0);
        expect(StringUtils.findNextWhitespaceCharacter(' a b')).toBe(0);
        expect(StringUtils.findNextWhitespaceCharacter('     a b c')).toBe(0);
        expect(StringUtils.findNextWhitespaceCharacter('a b c')).toBe(1);

        // custom offset
        expect(StringUtils.findNextWhitespaceCharacter('a b c', 2)).toBe(3);
    });

    test('isEOL', () => {
        // empty, space, regular character, non-string
        expect(StringUtils.isEOL('')).toBeFalsy();
        expect(StringUtils.isEOL(' ')).toBeFalsy();
        expect(StringUtils.isEOL('a')).toBeFalsy();
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        expect(StringUtils.isEOL(<any>1)).toBeFalsy();

        // line feed
        expect(StringUtils.isEOL('\n')).toBeTruthy();

        // carriage return
        expect(StringUtils.isEOL('\r')).toBeTruthy();

        // form feed
        expect(StringUtils.isEOL('\f')).toBeTruthy();
    });

    test('skipWS', () => {
        expect(StringUtils.skipWS('')).toBe(0);
        expect(StringUtils.skipWS(' ')).toBe(1);
        expect(StringUtils.skipWS('  ')).toBe(2);
        expect(StringUtils.skipWS('a')).toBe(0);
        expect(StringUtils.skipWS(' a')).toBe(1);
        expect(StringUtils.skipWS(' a b')).toBe(1);
        expect(StringUtils.skipWS('     a b c')).toBe(5);

        // custom offset
        expect(StringUtils.skipWS('a b c', 3)).toBe(4);
    });

    test('skipWSBack', () => {
        expect(StringUtils.skipWSBack('')).toBe(-1);
        expect(StringUtils.skipWSBack(' ')).toBe(-1);
        expect(StringUtils.skipWSBack('  ')).toBe(-1);
        expect(StringUtils.skipWSBack('a')).toBe(0);
        expect(StringUtils.skipWSBack(' a')).toBe(1);
        expect(StringUtils.skipWSBack(' a b')).toBe(3);
        expect(StringUtils.skipWSBack('     a b c')).toBe(9);

        // custom offset
        expect(StringUtils.skipWSBack('a b c', 3)).toBe(2);
        expect(StringUtils.skipWSBack('     a b c', 2)).toBe(-1);
    });

    describe('escapeCharacters', () => {
        test.each([
            {
                actual: '',
                expected: '',
                characters: new Set(['a']),
            },
            {
                actual: 'b',
                expected: 'b',
                characters: new Set(['a']),
            },
            {
                actual: 'a',
                expected: '\\a',
                characters: new Set(['a']),
            },
            {
                actual: 'b',
                expected: '\\b',
                characters: new Set(['a', 'b']),
            },
            {
                actual: 'aaabbbccc',
                expected: '\\a\\a\\abbb\\c\\c\\c',
                characters: new Set(['a', 'c']),
            },
            {
                actual: '\\',
                expected: '\\\\',
                characters: new Set(['\\']),
            },
        // eslint-disable-next-line max-len
        ])('escapeCharacters returns \'$expected\' when given \'$actual\' and \'$characters\'', ({ actual, expected, characters }) => {
            expect(StringUtils.escapeCharacters(actual, characters)).toBe(expected);
        });
    });
});
