import { TokenType } from '../../src/common/enums/token-types';
import { addAsProp, testTokenization } from '../helpers/test-utils';

describe('numeric-token', () => {
    // Test data from https://developer.mozilla.org/en-US/docs/Web/CSS/number
    // + some extra cases
    const testData = [
        // A raw <integer> is also a <number>
        '0',
        '1',
        '-1',
        '12',
        // Positive fraction
        '4.01',
        // Negative fraction
        '-456.8',
        // Zero
        '0.0',
        // Zero, with a leading +
        '+0.0',
        // Zero, with a leading -
        '-0.0',
        // Fractional number without a leading zero
        '.6',
        '.60',
        // Scientific notation
        '10e3',
        '10e33',
        // Complicated scientific notation
        '-3.4e-2',
        '-3.4e+2',
        '-3.4e-20',
        '-3.4e+20',
    ];

    // Create test cases for <number-token>, <percentage-token> and <dimension-token> based on the test data
    test.each([
        // <number-token> cases
        ...addAsProp(testData.map((value) => ({
            actual: value,
            expected: [
                [TokenType.Number, 0, value.length],
            ],
        }))),

        // <percentage-token> cases
        ...addAsProp(testData.map((value) => ({
            actual: `${value}%`,
            expected: [
                [TokenType.Percentage, 0, value.length + 1],
            ],
        }))),

        // <dimension-token> cases
        ...addAsProp(testData.map((value) => ({
            actual: `${value}px`,
            expected: [
                [TokenType.Dimension, 0, value.length + 2],
            ],
        }))),
        ...addAsProp(testData.map((value) => ({
            actual: `${value}rem`,
            expected: [
                [TokenType.Dimension, 0, value.length + 3],
            ],
        }))),
    ])("should tokenize '$actual' as $as", testTokenization);
});
