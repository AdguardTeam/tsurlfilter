import { NULL } from '../../utils/constants.js';
import { type NetworkRule } from '../../nodes/index.js';
import { type OutputByteBuffer } from '../../utils/output-byte-buffer.js';
import { isUndefined } from '../../utils/type-guards.js';
import { ValueSerializer } from '../misc/value-serializer.js';
import { BaseSerializer } from '../base-serializer.js';
import { ModifierListSerializer } from '../misc/modifier-list-serializer.js';
import { NetworkRuleMarshallingMap } from '../../marshalling-utils/network/network-rule-common.js';
import { BinaryTypeMarshallingMap } from '../../marshalling-utils/misc/binary-type-common.js';
import { getSyntaxSerializationMap } from '../../marshalling-utils/syntax-serialization-map.js';

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
        buffer.writeUint8(BinaryTypeMarshallingMap.NetworkRuleNode);

        buffer.writeUint8(NetworkRuleMarshallingMap.Syntax);
        buffer.writeUint8(getSyntaxSerializationMap().get(node.syntax) ?? 0);

        buffer.writeUint8(NetworkRuleMarshallingMap.Exception);
        buffer.writeUint8(node.exception ? 1 : 0);

        buffer.writeUint8(NetworkRuleMarshallingMap.Pattern);
        ValueSerializer.serialize(node.pattern, buffer);

        if (!isUndefined(node.modifiers)) {
            buffer.writeUint8(NetworkRuleMarshallingMap.ModifierList);
            ModifierListSerializer.serialize(node.modifiers, buffer);
        }

        if (!isUndefined(node.start)) {
            buffer.writeUint8(NetworkRuleMarshallingMap.Start);
            buffer.writeUint32(node.start);
        }

        if (!isUndefined(node.end)) {
            buffer.writeUint8(NetworkRuleMarshallingMap.End);
            buffer.writeUint32(node.end);
        }

        buffer.writeUint8(NULL);
    }
}
