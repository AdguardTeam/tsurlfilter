import { NULL } from '../../utils/constants';
import { type OutputByteBuffer } from '../../utils/output-byte-buffer';
import { isUndefined } from '../../utils/type-guards';
import { BinaryTypeMap, type CommentRule } from '../../nodes';
import { ValueSerializer } from '../misc/value-serializer';
import { BaseSerializer } from '../base-serializer';
import { SimpleCommentRuleMarshallingMap } from '../../serialization-utils/comment/simple-comment-common';

/**
 * `SimpleCommentSerializer` is responsible for parsing simple comments.
 * Some comments have a special meaning in adblock syntax, like agent comments or hints,
 * but this parser is only responsible for parsing regular comments,
 * whose only purpose is to provide some human-readable information.
 *
 * @example
 * ```adblock
 * ! This is a simple comment
 * # This is a simple comment, but in host-like syntax
 * ```
 */
export class SimpleCommentSerializer extends BaseSerializer {
    /**
     * Serializes a simple comment rule node to binary format.
     *
     * @param node Node to serialize.
     * @param buffer ByteBuffer for writing binary data.
     */
    // TODO: add support for raws, if ever needed
    public static serialize(node: CommentRule, buffer: OutputByteBuffer): void {
        buffer.writeUint8(BinaryTypeMap.CommentRuleNode);

        buffer.writeUint8(SimpleCommentRuleMarshallingMap.Marker);
        ValueSerializer.serialize(node.marker, buffer);

        buffer.writeUint8(SimpleCommentRuleMarshallingMap.Text);
        ValueSerializer.serialize(node.text, buffer);

        if (!isUndefined(node.start)) {
            buffer.writeUint8(SimpleCommentRuleMarshallingMap.Start);
            buffer.writeUint32(node.start);
        }

        if (!isUndefined(node.end)) {
            buffer.writeUint8(SimpleCommentRuleMarshallingMap.End);
            buffer.writeUint32(node.end);
        }

        buffer.writeUint8(NULL);
    }
}