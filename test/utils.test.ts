import * as utils from '../src/utils';

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
