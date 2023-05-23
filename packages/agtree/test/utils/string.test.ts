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

    test('isRegexPattern', () => {
        expect(StringUtils.isRegexPattern('')).toBe(false);
        expect(StringUtils.isRegexPattern('  ')).toBe(false);
        expect(StringUtils.isRegexPattern('/')).toBe(false);
        expect(StringUtils.isRegexPattern(' //')).toBe(false);
        expect(StringUtils.isRegexPattern('//')).toBe(false);

        expect(StringUtils.isRegexPattern('/a/')).toBe(true);
        expect(StringUtils.isRegexPattern('/a/ ')).toBe(true); // trim
        expect(StringUtils.isRegexPattern('  /a/   ')).toBe(true); // trim
        expect(StringUtils.isRegexPattern('/^regex$/')).toBe(true);
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
});
