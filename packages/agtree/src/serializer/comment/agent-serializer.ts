import { NULL } from '../../utils/constants.js';
import { type Agent } from '../../nodes/index.js';
import { ValueSerializer } from '../misc/value-serializer.js';
import { type OutputByteBuffer } from '../../utils/output-byte-buffer.js';
import { isUndefined } from '../../utils/type-guards.js';
import { BINARY_SCHEMA_VERSION } from '../../utils/binary-schema-version.js';
import { BaseSerializer } from '../base-serializer.js';
import {
    AgentNodeMarshallingMap,
    FREQUENT_AGENTS_DESERIALIZATION_MAP,
} from '../../marshalling-utils/comment/agent-common';
import { BinaryTypeMarshallingMap } from '../../marshalling-utils/misc/binary-type-common';

/**
 * Value map for binary serialization. This helps to reduce the size of the serialized data,
 * as it allows us to use a single byte to represent frequently used values.
 *
 * ! IMPORTANT: If you change values here, please update the {@link BINARY_SCHEMA_VERSION}!
 *
 * @note Only 256 values can be represented this way.
 */
let frequentAgentsSerializationMap: Map<string, number>;
const getFrequentAgentsSerializationMap = () => {
    if (!frequentAgentsSerializationMap) {
        frequentAgentsSerializationMap = new Map<string, number>(
            Array.from(FREQUENT_AGENTS_DESERIALIZATION_MAP).map(([key, value]) => [value.toLowerCase(), key]),
        );
    }
    return frequentAgentsSerializationMap;
};

/**
 * `AgentSerializer` is responsible for serializing single adblock agent elements into a binary format.
 */
export class AgentSerializer extends BaseSerializer {
    /**
     * Serializes an agent node to binary format.
     *
     * @param node Node to serialize.
     * @param buffer ByteBuffer for writing binary data.
     */
    public static serialize(node: Agent, buffer: OutputByteBuffer): void {
        buffer.writeUint8(BinaryTypeMarshallingMap.AgentNode);

        buffer.writeUint8(AgentNodeMarshallingMap.Adblock);
        ValueSerializer.serialize(node.adblock, buffer, getFrequentAgentsSerializationMap(), true);

        if (!isUndefined(node.version)) {
            buffer.writeUint8(AgentNodeMarshallingMap.Version);
            ValueSerializer.serialize(node.version, buffer);
        }

        if (!isUndefined(node.start)) {
            buffer.writeUint8(AgentNodeMarshallingMap.Start);
            buffer.writeUint32(node.start);
        }

        if (!isUndefined(node.end)) {
            buffer.writeUint8(AgentNodeMarshallingMap.End);
            buffer.writeUint32(node.end);
        }

        buffer.writeUint8(NULL);
    }
}
