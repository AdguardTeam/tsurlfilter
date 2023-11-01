import { TokenType } from '../../../src/common/enums/token-types';
import { type TokenTest, type TokenData } from '../../helpers/test-interfaces';
import { addAsProp } from '../../helpers/test-utils';

/**
 * Type for pseudo value expectations
 */
export type PseudoValues = { [key: string]: TokenData[] };

/**
 * Helper function to shift token positions in the test data
 *
 * @param values Values to shift
 * @param shift Amount to shift by
 * @returns Shifted values
 */
const shiftValues = (values: PseudoValues, shift: number): PseudoValues => {
    const result: PseudoValues = {};

    for (const key of Object.keys(values)) {
        result[key] = values[key].map(([type, start, end]) => [type, start + shift, end + shift]);
    }

    return result;
};

/**
 * Helper function to create test data for each pseudo name
 *
 * @param pseudos Pseudo names
 * @param values Pseudo value expectations
 * @returns Test data for each pseudo name
 */
export const createTests = (pseudos: string[], values: PseudoValues): TokenTest[] => {
    return pseudos.map((name: string) => (
        addAsProp(
            // Create tests for each pseudo name
            Object.entries(
                shiftValues(values, name.length + 2),
            ).map(([param, expected]) => ({
                actual: `:${name}(${param})`,
                expected: [
                    // :function-name(
                    [TokenType.Colon, 0, 1],
                    [TokenType.Function, 1, name.length + 2],
                    // parameter splitted into delim tokens
                    ...expected,
                    // )
                    // eslint-disable-next-line max-len
                    [TokenType.CloseParenthesis, 1 + name.length + param.length + 1, 1 + name.length + param.length + 2],
                ] as TokenData[],
            })),
        ))).flat();
};
