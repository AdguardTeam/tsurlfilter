import { TokenType } from '../../src/common/enums/token-types';
import { tokenize } from '../../src/css-tokenizer';
import { getFormattedTokenName } from '../../src/utils/token-names';
import type { TokenData } from '../helpers/test-interfaces';

describe('ident-token', () => {
    // Tests from https://developer.mozilla.org/en-US/docs/Web/CSS/ident
    test.each([
        String.raw`nono79`, // A mix of alphanumeric characters and numbers
        String.raw`ground-level`, // A mix of alphanumeric characters and a dash
        String.raw`-test`, // A dash followed by alphanumeric characters
        String.raw`--toto`, // A custom-property like identifier
        String.raw`_internal`, // An underscore followed by alphanumeric characters
        String.raw`bili\.bob`, // A correctly escaped period
        String.raw`\f09f8c80`, // A correctly escaped emoji
        String.raw`UPPERCASE`, // Uppercase letters
        String.raw`CamelCase`, // Camel case (mixed uppercase and lowercase letters)
        String.raw`\\75rl`, // Escaped characters
        String.raw`\\75 rl`, // Extra whitespace
        String.raw`\\0075 rl`, // Extra leading zeros and extra whitespace
    ])(`should tokenize '%s' as ${getFormattedTokenName(TokenType.Ident)}`, (actual) => {
        const tokens: TokenData[] = [];
        tokenize(actual, (...args) => tokens.push(args));
        expect(tokens).toEqual([
            [TokenType.Ident, 0, actual.length],
        ]);
    });
});
