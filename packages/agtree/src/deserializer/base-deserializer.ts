/**
 * @file Base deserializer class.
 */
import { NotImplementedError } from '../errors/not-implemented-error.js';
import { type Node } from '../nodes/index.js';
import { type InputByteBuffer } from '../utils/input-byte-buffer.js';

/**
 * Base class for deserializers. Each deserializer should extend this class.
 */
export class BaseDeserializer {
    /**
     * Deserializes the AST node from a byte buffer.
     *
     * @param buffer Input byte buffer to read from.
     * @param node Destination node to write to.
     * @param args Additional, parser-specific arguments, if needed.
     */
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    public static deserialize(buffer: InputByteBuffer, node: Partial<Node>, ...args: unknown[]): void {
        throw new NotImplementedError();
    }
}
