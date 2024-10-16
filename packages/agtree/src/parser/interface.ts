/* eslint-disable @typescript-eslint/no-unused-vars */
/**
 * @file Base parser class.
 */
import { NotImplementedError } from '../errors/not-implemented-error';
import { type InputByteBuffer } from '../utils/input-byte-buffer';
import { type Node } from '../nodes';
import { type ParserOptions } from './options';

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
    public static parse(input: string, options: ParserOptions, baseOffset: number, ...args: unknown[]): Node | null {
        throw new NotImplementedError();
    }

    /**
     * Deserializes the AST node from a byte buffer.
     *
     * @param buffer Input byte buffer to read from.
     * @param node Destination node to write to.
     * @param args Additional, parser-specific arguments, if needed.
     */
    public static deserialize(buffer: InputByteBuffer, node: Partial<Node>, ...args: unknown[]): void {
        throw new NotImplementedError();
    }
}
