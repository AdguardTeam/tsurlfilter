/* eslint-disable no-param-reassign */
import { NULL } from '../../utils/constants.js';
import {
    type HintCommentRule,
    CommentRuleType,
    type Hint,
    RuleCategory,
} from '../../nodes/index.js';
import { HintDeserializer } from './hint-deserializer.js';
import { AdblockSyntax } from '../../utils/adblockers.js';
import { BaseDeserializer } from '../base-deserializer.js';
import { HintCommentMarshallingMap } from '../../marshalling-utils/comment/hint-comment-common.js';
import { type InputByteBuffer } from '../../utils/input-byte-buffer.js';
import { BinaryTypeMarshallingMap } from '../../marshalling-utils/misc/binary-type-common.js';
import { getSyntaxDeserializationMap } from '../syntax-deserialization-map.js';

/**
 * `HintCommentDeserializer` is responsible for deserializing AdGuard hint rules.
 *
 * @example
 * The following hint rule
 * ```adblock
 * !+ NOT_OPTIMIZED PLATFORM(windows)
 * ```
 * contains two hints: `NOT_OPTIMIZED` and `PLATFORM`.
 * @see {@link https://kb.adguard.com/en/general/how-to-create-your-own-ad-filters#hints}
 */
export class HintCommentDeserializer extends BaseDeserializer {
    /**
     * Deserializes a hint rule node from binary format.
     *
     * @param buffer ByteBuffer for reading binary data.
     * @param node Destination node.
     * @throws If the binary data is malformed.
     */
    public static deserialize(buffer: InputByteBuffer, node: Partial<HintCommentRule>): void {
        buffer.assertUint8(BinaryTypeMarshallingMap.HintRuleNode);

        node.category = RuleCategory.Comment;
        node.type = CommentRuleType.HintCommentRule;

        let prop = buffer.readUint8();
        while (prop !== NULL) {
            switch (prop) {
                case HintCommentMarshallingMap.Syntax:
                    node.syntax = getSyntaxDeserializationMap().get(buffer.readUint8()) ?? AdblockSyntax.Common;
                    break;

                case HintCommentMarshallingMap.Children:
                    node.children = new Array(buffer.readUint8());

                    // read children
                    for (let i = 0; i < node.children.length; i += 1) {
                        HintDeserializer.deserialize(buffer, node.children[i] = {} as Hint);
                    }
                    break;

                case HintCommentMarshallingMap.Start:
                    node.start = buffer.readUint32();
                    break;

                case HintCommentMarshallingMap.End:
                    node.end = buffer.readUint32();
                    break;

                default:
                    throw new Error(`Invalid property: ${prop}`);
            }

            prop = buffer.readUint8();
        }
        // Maybe children are not present in the binary data,
        // in this case, we should initialize it as an empty array.
        if (!node.children) {
            node.children = [];
        }
    }
}
