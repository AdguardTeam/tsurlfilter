import { NULL, UINT8_MAX } from '../../utils/constants';
import { type AgentCommentRule, BinaryTypeMap } from '../../nodes';
import { AgentSerializer } from './agent-serializer';
import { type OutputByteBuffer } from '../../utils/output-byte-buffer';
import { isUndefined } from '../../utils/type-guards';
import { BINARY_SCHEMA_VERSION } from '../../utils/binary-schema-version';
import { BaseSerializer } from '../base-serializer';

/**
 * Property map for binary serialization. This helps to reduce the size of the serialized data,
 * as it allows us to use a single byte to represent a property.
 *
 * ! IMPORTANT: If you change values here, please update the {@link BINARY_SCHEMA_VERSION}!
 *
 * @note Only 256 values can be represented this way.
 */
const enum AgentRuleSerializationMap {
    Children = 1,
    Start,
    End,
}

/**
 * `AgentCommentSerializer` is responsible for serializing an Adblock agent comments.
 * Adblock agent comment marks that the filter list is supposed to
 * be used by the specified ad blockers.
 *
 * @example
 *  - ```adblock
 *    [AdGuard]
 *    ```
 *  - ```adblock
 *    [Adblock Plus 2.0]
 *    ```
 *  - ```adblock
 *    [uBlock Origin]
 *    ```
 *  - ```adblock
 *    [uBlock Origin 1.45.3]
 *    ```
 *  - ```adblock
 *    [Adblock Plus 2.0; AdGuard]
 *    ```
 */
export class AgentCommentSerializer extends BaseSerializer {
    /**
     * Serializes an adblock agent list node to binary format.
     *
     * @param node Node to serialize.
     * @param buffer ByteBuffer for writing binary data.
     */
    // TODO: add support for raws, if ever needed
    public static serialize(node: AgentCommentRule, buffer: OutputByteBuffer): void {
        buffer.writeUint8(BinaryTypeMap.AgentRuleNode);

        const count = node.children.length;
        if (count) {
            buffer.writeUint8(AgentRuleSerializationMap.Children);

            // note: we store the count, because re-construction of the array is faster if we know the length
            // 8 bits is more than enough here
            if (count > UINT8_MAX) {
                throw new Error(`Too many children: ${count}, the limit is ${UINT8_MAX}`);
            }
            buffer.writeUint8(count);

            for (let i = 0; i < count; i += 1) {
                AgentSerializer.serialize(node.children[i], buffer);
            }
        }

        if (!isUndefined(node.start)) {
            buffer.writeUint8(AgentRuleSerializationMap.Start);
            buffer.writeUint32(node.start);
        }

        if (!isUndefined(node.end)) {
            buffer.writeUint8(AgentRuleSerializationMap.End);
            buffer.writeUint32(node.end);
        }

        buffer.writeUint8(NULL);
    }
}
