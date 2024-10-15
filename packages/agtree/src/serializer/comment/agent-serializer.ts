import { NULL } from '../../utils/constants';
import { BinaryTypeMap, type Agent } from '../../nodes';
import { ValueSerializer } from '../misc/value-serializer';
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
const enum AgentNodeSerializationMap {
    Adblock = 1,
    Version,
    Start,
    End,
}

/**
 * Value map for binary deserialization. This helps to reduce the size of the serialized data,
 * as it allows us to use a single byte to represent frequently used values.
 */
const FREQUENT_AGENTS_DESERIALIZATION_MAP = new Map<number, string>([
    // AdGuard
    [0, 'AdGuard'],
    [1, 'ADG'],

    // uBlock Origin
    [2, 'uBlock Origin'],
    [3, 'uBlock'],
    [4, 'uBO'],

    // Adblock Plus
    [5, 'Adblock Plus'],
    [6, 'AdblockPlus'],
    [7, 'ABP'],
    [8, 'AdBlock'],
]);

/**
 * Value map for binary serialization. This helps to reduce the size of the serialized data,
 * as it allows us to use a single byte to represent frequently used values.
 *
 * ! IMPORTANT: If you change values here, please update the {@link BINARY_SCHEMA_VERSION}!
 *
 * @note Only 256 values can be represented this way.
 */
// FIXME
const FREQUENT_AGENTS_SERIALIZATION_MAP = new Map<string, number>(
    Array.from(FREQUENT_AGENTS_DESERIALIZATION_MAP).map(([key, value]) => [value.toLowerCase(), key]),
);

/**
 * `AgentParser` is responsible for parsing single adblock agent elements.
 *
 * @example
 * If the adblock agent rule is
 * ```adblock
 * [Adblock Plus 2.0; AdGuard]
 * ```
 * then the adblock agents are `Adblock Plus 2.0` and `AdGuard`, and this
 * class is responsible for parsing them. The rule itself is parsed by
 * `AgentCommentSerializer`, which uses this class to parse single agents.
 */
export class AgentSerializer extends BaseSerializer {
    /**
     * Serializes an agent node to binary format.
     *
     * @param node Node to serialize.
     * @param buffer ByteBuffer for writing binary data.
     */
    public static serialize(node: Agent, buffer: OutputByteBuffer): void {
        buffer.writeUint8(BinaryTypeMap.AgentNode);

        buffer.writeUint8(AgentNodeSerializationMap.Adblock);
        ValueSerializer.serialize(node.adblock, buffer, FREQUENT_AGENTS_SERIALIZATION_MAP, true);

        if (!isUndefined(node.version)) {
            buffer.writeUint8(AgentNodeSerializationMap.Version);
            ValueSerializer.serialize(node.version, buffer);
        }

        if (!isUndefined(node.start)) {
            buffer.writeUint8(AgentNodeSerializationMap.Start);
            buffer.writeUint32(node.start);
        }

        if (!isUndefined(node.end)) {
            buffer.writeUint8(AgentNodeSerializationMap.End);
            buffer.writeUint32(node.end);
        }

        buffer.writeUint8(NULL);
    }
}
