import { NULL } from '../../utils/constants';
import { type HintCommentRule } from '../../nodes';
import { HintSerializer } from './hint-serializer';
import { AdblockSyntax } from '../../utils/adblockers';
import { type OutputByteBuffer } from '../../utils/output-byte-buffer';
import { isUndefined } from '../../utils/type-guards';
import { BaseSerializer } from '../base-serializer';
import { HintRuleMarshallingMap } from '../../marshalling-utils/comment/hint-comment-common';
import { BinaryTypeMarshallingMap } from '../../marshalling-utils/misc/binary-type-common';
import { getSyntaxSerializationMap } from '../../marshalling-utils/syntax-serialization-map';

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
            buffer.writeUint8(HintRuleMarshallingMap.Syntax);
            buffer.writeUint8(getSyntaxSerializationMap().get(AdblockSyntax.Adg) ?? 0);
        }

        const count = node.children.length;
        if (count) {
            buffer.writeUint8(HintRuleMarshallingMap.Children);
            // note: we store the count, because re-construction of the array is faster if we know the length
            buffer.writeUint8(count);

            for (let i = 0; i < count; i += 1) {
                HintSerializer.serialize(node.children[i], buffer);
            }
        }

        if (!isUndefined(node.start)) {
            buffer.writeUint8(HintRuleMarshallingMap.Start);
            buffer.writeUint32(node.start);
        }

        if (!isUndefined(node.end)) {
            buffer.writeUint8(HintRuleMarshallingMap.End);
            buffer.writeUint32(node.end);
        }

        buffer.writeUint8(NULL);
    }
}
