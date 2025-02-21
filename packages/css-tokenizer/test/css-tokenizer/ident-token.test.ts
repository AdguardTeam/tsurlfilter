import { TokenType } from '../../src/common/enums/token-types';
import { type OnTokenCallback } from '../../src/common/types/function-prototypes';
import { tokenize } from '../../src/css-tokenizer';
import { getFormattedTokenName } from '../../src/utils/token-names';

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
        const onToken: jest.MockedFunction<OnTokenCallback> = jest.fn();

        tokenize(actual, onToken);

        expect(onToken).toHaveBeenCalledTimes(1);
        expect(onToken.mock.calls[0]?.slice(0, 3)).toEqual([TokenType.Ident, 0, actual.length]);
    });
});
