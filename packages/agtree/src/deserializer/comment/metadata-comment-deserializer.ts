/* eslint-disable no-param-reassign */
import { NULL } from '../../utils/constants.js';
import {
    type MetadataCommentRule,
    CommentRuleType,
    RuleCategory,
    type Value,
} from '../../nodes/index.js';
import { BaseDeserializer } from '../base-deserializer.js';
import {
    FREQUENT_HEADERS_DESERIALIZATION_MAP,
    MetadataCommentMarshallingMap,
} from '../../marshalling-utils/comment/metadata-comment-common.js';
import { type InputByteBuffer } from '../../utils/input-byte-buffer.js';
import { AdblockSyntax } from '../../utils/adblockers.js';
import { ValueDeserializer } from '../misc/value-deserializer.js';
import { BinaryTypeMarshallingMap } from '../../marshalling-utils/misc/binary-type-common.js';

/**
 * `MetadataCommentDeserializer` is responsible for deserializing metadata comments.
 * Metadata comments are special comments that specify some properties of the list.
 *
 * @example
 * For example, in the case of
 * ```adblock
 * ! Title: My List
 * ```
 * the name of the header is `Title`, and the value is `My List`, which means that
 * the list title is `My List`, and it can be used in the adblocker UI.
 * @see {@link https://help.eyeo.com/adblockplus/how-to-write-filters#special-comments}
 */
export class MetadataCommentDeserializer extends BaseDeserializer {
    /**
     * Deserializes a metadata comment node from binary format.
     *
     * @param buffer ByteBuffer for reading binary data.
     * @param node Destination node.
     * @throws If the binary data is malformed.
     */
    public static deserialize(buffer: InputByteBuffer, node: Partial<MetadataCommentRule>): void {
        buffer.assertUint8(BinaryTypeMarshallingMap.MetadataCommentRuleNode);

        node.type = CommentRuleType.MetadataCommentRule;
        node.category = RuleCategory.Comment;
        node.syntax = AdblockSyntax.Common;

        let prop = buffer.readUint8();
        while (prop !== NULL) {
            switch (prop) {
                case MetadataCommentMarshallingMap.Marker:
                    ValueDeserializer.deserialize(buffer, node.marker = {} as Value);
                    break;

                case MetadataCommentMarshallingMap.Header:
                    // eslint-disable-next-line max-len
                    ValueDeserializer.deserialize(buffer, node.header = {} as Value, FREQUENT_HEADERS_DESERIALIZATION_MAP);
                    break;

                case MetadataCommentMarshallingMap.Value:
                    ValueDeserializer.deserialize(buffer, node.value = {} as Value);
                    break;

                case MetadataCommentMarshallingMap.Start:
                    node.start = buffer.readUint32();
                    break;

                case MetadataCommentMarshallingMap.End:
                    node.end = buffer.readUint32();
                    break;

                default:
                    throw new Error(`Invalid property: ${prop}`);
            }

            prop = buffer.readUint8();
        }
    }
}
