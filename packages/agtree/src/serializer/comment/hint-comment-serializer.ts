import { NULL } from '../../utils/constants';
import { type HintCommentRule, BinaryTypeMap, getSyntaxSerializationMap } from '../../nodes';
import { HintSerializer } from './hint-serializer';
import { AdblockSyntax } from '../../utils/adblockers';
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
const enum HintRuleSerializationMap {
    Syntax = 1,
    Children,
    Start,
    End,
}

/**
 * `HintCommentSerializer` is responsible for serializing AdGuard hint rules.
 *
 * @example
 * The following hint rule
 * ```adblock
 * !+ NOT_OPTIMIZED PLATFORM(windows)
 * ```
 * contains two hints: `NOT_OPTIMIZED` and `PLATFORM`.
 * @see {@link https://kb.adguard.com/en/general/how-to-create-your-own-ad-filters#hints}
 */
export class HintCommentSerializer extends BaseSerializer {
    /**
     * Serializes a hint rule node to binary format.
     *
     * @param node Node to serialize.
     * @param buffer ByteBuffer for writing binary data.
     */
    // TODO: add support for raws, if ever needed
    public static serialize(node: HintCommentRule, buffer: OutputByteBuffer): void {
        buffer.writeUint8(BinaryTypeMap.HintRuleNode);

        if (node.syntax === AdblockSyntax.Adg) {
            buffer.writeUint8(HintRuleSerializationMap.Syntax);
            buffer.writeUint8(getSyntaxSerializationMap().get(AdblockSyntax.Adg) ?? 0);
        }

        const count = node.children.length;
        if (count) {
            buffer.writeUint8(HintRuleSerializationMap.Children);
            // note: we store the count, because re-construction of the array is faster if we know the length
            buffer.writeUint8(count);

            for (let i = 0; i < count; i += 1) {
                HintSerializer.serialize(node.children[i], buffer);
            }
        }

        if (!isUndefined(node.start)) {
            buffer.writeUint8(HintRuleSerializationMap.Start);
            buffer.writeUint32(node.start);
        }

        if (!isUndefined(node.end)) {
            buffer.writeUint8(HintRuleSerializationMap.End);
            buffer.writeUint32(node.end);
        }

        buffer.writeUint8(NULL);
    }
}