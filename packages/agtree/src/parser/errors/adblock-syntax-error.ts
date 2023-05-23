/**
 * @file Customized syntax error class for Adblock Filter Parser.
 */
import { LocationRange } from '../common';

/**
 * Customized syntax error class for Adblock Filter Parser,
 * which contains the location range of the error.
 */
export class AdblockSyntaxError extends SyntaxError {
    /**
     * Location range of the error.
     */
    loc: LocationRange;

    /**
     * Constructs a new `AdblockSyntaxError` instance.
     *
     * @param message Error message
     * @param loc Location range of the error
     */
    constructor(message: string, loc: LocationRange) {
        super(message);

        this.name = 'AdblockSyntaxError';
        this.loc = loc;
    }
}
