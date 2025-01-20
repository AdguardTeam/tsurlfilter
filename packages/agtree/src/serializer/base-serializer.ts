/**
 * @file Base serializer class.
 */
import { NotImplementedError } from '../errors/not-implemented-error';
import { type OutputByteBuffer } from '../utils/output-byte-buffer';
import { type Node } from '../nodes';

/**
 * Base class for serializers. Each serializer should extend this class.
 */
export class BaseSerializer {
    /**
     * Serializes the AST node to a byte buffer.
     *
     * @param node AST node to serialize.
     * @param buffer Output byte buffer to write to.
     * @param args Additional, parser-specific arguments, if needed.
     */
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    public static serialize(node: Node, buffer: OutputByteBuffer, ...args: unknown[]): void {
        throw new NotImplementedError();
    }
}
