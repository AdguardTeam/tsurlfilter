import { NULL } from '../../utils/constants.js';
import { type HintCommentRule } from '../../nodes/index.js';
import { HintSerializer } from './hint-serializer.js';
import { AdblockSyntax } from '../../utils/adblockers.js';
import { type OutputByteBuffer } from '../../utils/output-byte-buffer.js';
import { isUndefined } from '../../utils/type-guards.js';
import { BaseSerializer } from '../base-serializer.js';
import { HintCommentMarshallingMap } from '../../marshalling-utils/comment/hint-comment-common.js';
import { BinaryTypeMarshallingMap } from '../../marshalling-utils/misc/binary-type-common.js';
import { getSyntaxSerializationMap } from '../../marshalling-utils/syntax-serialization-map.js';

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
        buffer.writeUint8(BinaryTypeMarshallingMap.HintRuleNode);

        if (node.syntax === AdblockSyntax.Adg) {
            buffer.writeUint8(HintCommentMarshallingMap.Syntax);
            buffer.writeUint8(getSyntaxSerializationMap().get(AdblockSyntax.Adg) ?? 0);
        }

        const count = node.children.length;
        // If there are no children, we do not write any data related to them, to avoid using unnecessary storage,
        // but children is a required field, so during deserialization we should initialize it as an empty array,
        // if there are no children in the binary data.
        if (count) {
            buffer.writeUint8(HintCommentMarshallingMap.Children);
            // note: we store the count, because re-construction of the array is faster if we know the length
            buffer.writeUint8(count);

            for (let i = 0; i < count; i += 1) {
                HintSerializer.serialize(node.children[i], buffer);
            }
        }

        if (!isUndefined(node.start)) {
            buffer.writeUint8(HintCommentMarshallingMap.Start);
            buffer.writeUint32(node.start);
        }

        if (!isUndefined(node.end)) {
            buffer.writeUint8(HintCommentMarshallingMap.End);
            buffer.writeUint32(node.end);
        }

        buffer.writeUint8(NULL);
    }
}
