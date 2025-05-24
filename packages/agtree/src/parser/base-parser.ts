/**
 * @file Base parser class.
 */
import { NotImplementedError } from '../errors/not-implemented-error.js';
import { type Node } from '../nodes/index.js';
import { type ParserOptions } from './options.js';

/**
 * Base class for parsers. Each parser should extend this class.
 */
export class BaseParser {
    /**
     * Parses the input string and returns the AST node.
     *
     * @param input Input string to parse.
     * @param options Parser options, see {@link ParserOptions}.
     * @param baseOffset Base offset. Locations in the AST node will be relative to this offset.
     * @param args Additional, parser-specific arguments, if needed.
     */
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    public static parse(input: string, options: ParserOptions, baseOffset: number, ...args: unknown[]): Node | null {
        throw new NotImplementedError();
    }
}
