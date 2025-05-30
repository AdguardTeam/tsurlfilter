/**
 * @file Customized syntax error class for Adblock Filter Parser.
 */

const ERROR_NAME = 'AdblockSyntaxError';

/**
 * Customized syntax error class for Adblock Filter Parser,
 * which contains the location range of the error.
 */
export class AdblockSyntaxError extends SyntaxError {
    /**
     * Start offset of the error.
     */
    start: number;

    /**
     * End offset of the error.
     */
    end: number;

    /**
     * Constructs a new `AdblockSyntaxError` instance.
     *
     * @param message Error message.
     * @param start Start offset of the error.
     * @param end End offset of the error.
     */
    constructor(message: string, start: number, end: number) {
        super(message);

        this.name = ERROR_NAME;
        this.start = start;
        this.end = end;
    }
}
