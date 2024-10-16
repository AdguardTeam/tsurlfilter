/* eslint-disable no-param-reassign */
import { NULL } from '../../utils/constants';
import { BinaryTypeMap, type Value, type Agent } from '../../nodes';
import { BaseDeserializer } from '../base-deserializer';
import { type InputByteBuffer } from '../../utils/input-byte-buffer';
import {
    AgentNodeSerializationMap,
    FREQUENT_AGENTS_DESERIALIZATION_MAP,
} from '../../serialization-utils/comment/agent-common';
import { getAdblockSyntax } from '../../common/agent-common';
import { ValueDeserializer } from '../misc/value-deserializer';

/**
 * `AgentDeserializer` is responsible for deserializing single adblock agent elements.
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
export class AgentDeserializer extends BaseDeserializer {
    /**
     * Deserializes an agent node from binary format.
     *
     * @param buffer ByteBuffer for reading binary data.
     * @param node Destination node.
     * @throws If the binary data is malformed.
     */
    public static deserialize(buffer: InputByteBuffer, node: Partial<Agent>): void {
        buffer.assertUint8(BinaryTypeMap.AgentNode);

        node.type = 'Agent';

        let prop = buffer.readUint8();
        while (prop !== NULL) {
            switch (prop) {
                case AgentNodeSerializationMap.Adblock:
                    // eslint-disable-next-line max-len
                    ValueDeserializer.deserialize(buffer, node.adblock = {} as Value, FREQUENT_AGENTS_DESERIALIZATION_MAP);
                    if (node.adblock) {
                        node.syntax = getAdblockSyntax(node.adblock.value);
                    }
                    break;

                case AgentNodeSerializationMap.Version:
                    ValueDeserializer.deserialize(buffer, node.version = {} as Value);
                    break;

                case AgentNodeSerializationMap.Start:
                    node.start = buffer.readUint32();
                    break;

                case AgentNodeSerializationMap.End:
                    node.end = buffer.readUint32();
                    break;

                default:
                    throw new Error(`Invalid property: ${prop}`);
            }

            prop = buffer.readUint8();
        }
    }
}
