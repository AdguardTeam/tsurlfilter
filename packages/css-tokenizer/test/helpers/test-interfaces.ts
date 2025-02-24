import { type TokenType } from '../../src/common/enums/token-types';

/**
 * Token data
 *
 * @param type Token type
 * @param start Token start offset
 * @param end Token end offset
 * @param props Other token properties (if any)
 *
 * @todo Create a more specific type for `props` parameter, if needed & possible
 */
export type TokenData = [
    type: TokenType,
    start: number,
    end: number,
    props?: Record<string, unknown>,
    ...rest: unknown[],
];

/**
 * Error data
 *
 * @param message Error message
 * @param start Error start offset
 * @param end Error end offset
 */
export type ErrorData = [message: string, start: number, end: number];

/**
 * Interface for token test data
 */
export interface TokenTest {
    /**
     * Name of the test (optional)
     */
    name?: string;

    /**
     * Actual CSS code
     */
    actual: string;

    /**
     * Expected token data (result of getTokenNameList() function) (optional - generated automatically)
     */
    as?: string;

    /**
     * Expected token data
     */
    expected: TokenData[];
}
