import { TokenType } from '../../../src/common/enums/token-types';
import { type TokenData } from '../../helpers/test-interfaces';
import { type PseudoValues } from './test-creator';

/**
 * Helper function to generate token expectations for values that should be tokenized as delim tokens.
 *
 * @param inputs Inputs to generate delim pseudo values for.
 *
 * @returns Expected token data for each input.
 */
export const generateDelimStream = (inputs: string[]): PseudoValues => {
    const result: PseudoValues = {};

    for (const input of inputs) {
        result[input] = input.split('').map((_, index) => (
            [TokenType.Delim, index, index + 1] as TokenData
        ));
    }

    return result;
};
