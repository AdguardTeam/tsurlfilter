import * as utils from '../../src/utils/utils';

describe('splitByDelimiterWithEscapeCharacter', () => {
    it('works if it splits with or without preserving tokens', () => {
        let parts = utils.splitByDelimiterWithEscapeCharacter('example.org,,,example.com', ',', '\\', false);
        expect(parts.length).toEqual(2);

        parts = utils.splitByDelimiterWithEscapeCharacter('example.org,,,example.com', ',', '\\', true);
        expect(parts.length).toEqual(4);

        parts = utils.splitByDelimiterWithEscapeCharacter('example.org\\,\\,\\,example.com', ',', '\\', true);
        expect(parts.length).toEqual(1);

        parts = utils.splitByDelimiterWithEscapeCharacter('', ',', '\\', true);
        expect(parts.length).toEqual(0);

        parts = utils.splitByDelimiterWithEscapeCharacter(',example.org,example.com', ',', '\\', false);
        expect(parts.length).toEqual(2);
    });
});

describe('startsAtIndexWith', () => {
    it('works if it can check simple strings', () => {
        expect(utils.startsAtIndexWith('example', 0, 'ex')).toEqual(true);
        expect(utils.startsAtIndexWith('example', 1, 'xa')).toEqual(true);
        expect(utils.startsAtIndexWith('example', 6, 'e')).toEqual(true);
    });
});

describe('replaceAll', () => {
    it('works if it can replace simple strings', () => {
        expect(utils.replaceAll('example_example', 'ex', 'EX')).toEqual('EXample_EXample');
    });
});

describe('fastHash', () => {
    it('works if it can fastHash', () => {
        expect(utils.fastHash('')).toEqual(0);
        expect(utils.fastHash('test')).toEqual(6385723493);
    });

    it('works if it can fastHashBetween', () => {
        expect(utils.fastHashBetween('', 0, 0)).toEqual(5381);
        expect(utils.fastHashBetween('test', 1, 2)).toEqual(177674);
    });
});
