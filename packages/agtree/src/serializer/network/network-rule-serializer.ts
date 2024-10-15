import { NULL } from '../../utils/constants';
import { type NetworkRule, BinaryTypeMap, getSyntaxSerializationMap } from '../../nodes';
import { type OutputByteBuffer } from '../../utils/output-byte-buffer';
import { isUndefined } from '../../utils/type-guards';
import { ValueSerializer } from '../misc/value-serializer';
import { BINARY_SCHEMA_VERSION } from '../../utils/binary-schema-version';
import { BaseSerializer } from '../base-serializer';
import { ModifierListSerializer } from '../misc/modifier-list-serializer';

/**
 * Property map for binary serialization. This helps to reduce the size of the serialized data,
 * as it allows us to use a single byte to represent a property.
 *
 * ! IMPORTANT: If you change values here, please update the {@link BINARY_SCHEMA_VERSION}!
 *
 * @note Only 256 values can be represented this way.
 */
const enum NetworkRuleSerializationMap {
    Syntax = 1,
    Raws,
    Exception,
    Pattern,
    ModifierList,
    Start,
    End,
}

/**
 * `NetworkRuleSerializer` is responsible for serializing network rules.
 *
 * @see {@link https://kb.adguard.com/en/general/how-to-create-your-own-ad-filters#basic-rules}
 * @see {@link https://help.eyeo.com/adblockplus/how-to-write-filters#basic}
 */
export class NetworkRuleSerializer extends BaseSerializer {
    /**
     * Serializes a network rule node to binary format.
     *
     * @param node Node to serialize.
     * @param buffer ByteBuffer for writing binary data.
     */
    // TODO: add support for raws, if ever needed
    public static serialize(node: NetworkRule, buffer: OutputByteBuffer): void {
        buffer.writeUint8(BinaryTypeMap.NetworkRuleNode);

        buffer.writeUint8(NetworkRuleSerializationMap.Syntax);
        buffer.writeUint8(getSyntaxSerializationMap().get(node.syntax) ?? 0);

        buffer.writeUint8(NetworkRuleSerializationMap.Exception);
        buffer.writeUint8(node.exception ? 1 : 0);

        buffer.writeUint8(NetworkRuleSerializationMap.Pattern);
        ValueSerializer.serialize(node.pattern, buffer);

        if (!isUndefined(node.modifiers)) {
            buffer.writeUint8(NetworkRuleSerializationMap.ModifierList);
            ModifierListSerializer.serialize(node.modifiers, buffer);
        }

        if (!isUndefined(node.start)) {
            buffer.writeUint8(NetworkRuleSerializationMap.Start);
            buffer.writeUint32(node.start);
        }

        if (!isUndefined(node.end)) {
            buffer.writeUint8(NetworkRuleSerializationMap.End);
            buffer.writeUint32(node.end);
        }

        buffer.writeUint8(NULL);
    }
}
