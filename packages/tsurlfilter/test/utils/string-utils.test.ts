/* eslint-disable max-len */
import console from 'console';
import * as stringUtils from '../../src/utils/string-utils';

describe('splitByDelimiterWithEscapeCharacter', () => {
    it('works if it splits with or without preserving tokens', () => {
        let parts = stringUtils.splitByDelimiterWithEscapeCharacter('example.org,,,example.com', ',', '\\', false);
        expect(parts.length).toEqual(2);

        parts = stringUtils.splitByDelimiterWithEscapeCharacter('example.org,,,example.com', ',', '\\', true);
        expect(parts.length).toEqual(4);

        parts = stringUtils.splitByDelimiterWithEscapeCharacter('example.org\\,\\,\\,example.com', ',', '\\', true);
        expect(parts.length).toEqual(1);

        parts = stringUtils.splitByDelimiterWithEscapeCharacter('', ',', '\\', true);
        expect(parts.length).toEqual(0);

        parts = stringUtils.splitByDelimiterWithEscapeCharacter(',example.org,example.com', ',', '\\', false);
        expect(parts.length).toEqual(2);

        parts = stringUtils.splitByDelimiterWithEscapeCharacter('/text-to-be-replaced/new-text/i', '/', '\\', true);
        expect(parts.length).toEqual(3);

        parts = stringUtils.splitByDelimiterWithEscapeCharacter('/(<VAST[\\s\\S]*?>)[\\s\\S]*<\\/VAST>/$1<\\/VAST>/', '/', '\\', true);
        expect(parts.length).toEqual(3);

        parts = stringUtils.splitByDelimiterWithEscapeCharacter('qwe\\,rty,1,2,3', ',', '\\', false, false);
        expect(parts[0]).toEqual('qwe\\,rty');
    });

    it('measures splitByDelimiterWithEscapeCharacter', async () => {
        const startParse = Date.now();

        // 200000 iterations in 12774ms

        let count = 0;
        while (count < 2000) {
            count += 1;

            let parts = stringUtils.splitByDelimiterWithEscapeCharacter('example.org,,,example.com', ',', '\\', false);
            expect(parts.length).toEqual(2);

            parts = stringUtils.splitByDelimiterWithEscapeCharacter('example.org,,,example.com', ',', '\\', true);
            expect(parts.length).toEqual(4);
        }

        console.log(`Elapsed time: ${Date.now() - startParse}`);
    });
});

describe('startsAtIndexWith', () => {
    it('works if it can check simple strings', () => {
        expect(stringUtils.startsAtIndexWith('example', 0, 'ex')).toEqual(true);
        expect(stringUtils.startsAtIndexWith('example', 1, 'xa')).toEqual(true);
        expect(stringUtils.startsAtIndexWith('example', 6, 'e')).toEqual(true);
    });
});

describe('hasUnquotedSubstring', () => {
    it('works if it can check simple strings', () => {
        expect(stringUtils.hasUnquotedSubstring('example', 'ex')).toEqual(true);
        expect(stringUtils.hasUnquotedSubstring('"example"', 'ex')).toEqual(false);
        expect(stringUtils.hasUnquotedSubstring('\\"example\\"', 'ex')).toEqual(true);
    });
});

describe('replaceAll', () => {
    it('works if it can replace simple strings', () => {
        expect(stringUtils.replaceAll('example_example', 'ex', 'EX')).toEqual('EXample_EXample');
    });
});

describe('fastHash', () => {
    it('works if it can fastHash', () => {
        expect(stringUtils.fastHash('')).toEqual(0);
        expect(stringUtils.fastHash('test')).toEqual(6385723493);
    });

    it('works if it can fastHashBetween', () => {
        expect(stringUtils.fastHashBetween('', 0, 0)).toEqual(5381);
        expect(stringUtils.fastHashBetween('test', 1, 2)).toEqual(177674);
    });
});
