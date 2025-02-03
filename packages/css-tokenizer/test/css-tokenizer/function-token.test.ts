import { TokenType } from '../../src/common/enums/token-types';
import { tokenize } from '../../src/css-tokenizer';
import { getFormattedTokenName } from '../../src/utils/token-names';

describe('function-token', () => {
    test.each([
        'func(',
        '--func(',
        '_func(',
        'func1(',
        'func-1(',
        'func_1(',
        'func--1(',
        'func__1(',
        'func-1-(',
        'func_1_1(',
        String.raw`\\66unc(`, // Escaped characters
        String.raw`\\66 unc(`, // Extra whitespace
        String.raw`\\0066 unc(`, // Extra leading zeros and extra whitespace
    ])(`should tokenize '%s' as ${getFormattedTokenName(TokenType.Function)}`, (actual) => {
        const onToken: jest.MockedFunction<OnTokenCallback> = jest.fn();

        tokenize(actual, onToken);

        expect(onToken).toHaveBeenCalledTimes(1);
        expect(onToken.mock.calls[0]?.slice(0, 3)).toEqual([TokenType.Function, 0, actual.length]);
    });
});
