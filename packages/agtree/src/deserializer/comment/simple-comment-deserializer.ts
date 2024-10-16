/* eslint-disable no-param-reassign */
import { NULL } from '../../utils/constants';
import {
    BinaryTypeMap,
    CommentRuleType,
    RuleCategory,
    type Value,
    type CommentRule,
} from '../../nodes';
import { BaseDeserializer } from '../base-deserializer';
import { type InputByteBuffer } from '../../utils/input-byte-buffer';
import { AdblockSyntax } from '../../utils/adblockers';
import { SimpleCommentRuleSerializationMap } from '../../serialization-utils/comment/simple-comment-common';
import { ValueDeserializer } from '../misc/value-deserializer';

/**
 * `SimpleCommentDeserializer` is responsible for deserializing simple comments.
 *
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
export class SimpleCommentDeserializer extends BaseDeserializer {
    /**
     * Deserializes a simple comment node from binary format.
     *
     * @param buffer ByteBuffer for reading binary data.
     * @param node Destination node.
     * @throws If the binary data is malformed.
     */
    public static deserialize(buffer: InputByteBuffer, node: Partial<CommentRule>): void {
        buffer.assertUint8(BinaryTypeMap.CommentRuleNode);

        node.type = CommentRuleType.CommentRule;
        node.category = RuleCategory.Comment;
        node.syntax = AdblockSyntax.Common;

        let prop = buffer.readUint8();
        while (prop !== NULL) {
            switch (prop) {
                case SimpleCommentRuleSerializationMap.Marker:
                    ValueDeserializer.deserialize(buffer, (node as CommentRule).marker = {} as Value);
                    break;

                case SimpleCommentRuleSerializationMap.Text:
                    ValueDeserializer.deserialize(buffer, (node as CommentRule).text = {} as Value);
                    break;

                case SimpleCommentRuleSerializationMap.Start:
                    node.start = buffer.readUint32();
                    break;

                case SimpleCommentRuleSerializationMap.End:
                    node.end = buffer.readUint32();
                    break;

                default:
                    throw new Error(`Invalid property: ${prop}`);
            }

            prop = buffer.readUint8();
        }
    }
}
